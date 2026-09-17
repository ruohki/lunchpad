//! macOS: the Accessibility API for the windows themselves and AppKit for
//! the list of running programs and for activating one. Needs the
//! Accessibility permission, like typing keys does.

use super::{DesktopResult, Op, ScreenInfo, WindowInfo, HANDLE_PREFIX};
use core_foundation::array::{CFArray, CFArrayRef};
use core_foundation::base::{CFType, CFTypeRef, TCFType};
use core_foundation::boolean::CFBoolean;
use core_foundation::string::{CFString, CFStringRef};
use core_graphics::display::CGDisplay;
use objc2_app_kit::{
    NSApplicationActivationOptions, NSApplicationActivationPolicy, NSRunningApplication,
    NSWorkspace,
};
use std::ffi::c_void;

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct Point {
    x: f64,
    y: f64,
}
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct Size {
    width: f64,
    height: f64,
}

const AX_POINT: u32 = 1;
const AX_SIZE: u32 = 2;
/// The height the menu bar takes on most displays; the system keeps windows below it anyway.
const MENU_BAR: f64 = 25.0;

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXUIElementCreateApplication(pid: i32) -> CFTypeRef;
    fn AXUIElementCopyAttributeValue(
        element: CFTypeRef,
        attribute: CFStringRef,
        value: *mut CFTypeRef,
    ) -> i32;
    fn AXUIElementSetAttributeValue(
        element: CFTypeRef,
        attribute: CFStringRef,
        value: CFTypeRef,
    ) -> i32;
    fn AXUIElementPerformAction(element: CFTypeRef, action: CFStringRef) -> i32;
    fn AXValueCreate(kind: u32, value: *const c_void) -> CFTypeRef;
    fn AXValueGetValue(value: CFTypeRef, kind: u32, out: *mut c_void) -> bool;
    fn AXIsProcessTrusted() -> bool;
    /// Not in the headers, but what every window manager uses to pair an
    /// accessibility element with its window number.
    fn _AXUIElementGetWindow(element: CFTypeRef, out: *mut u32) -> i32;
}

fn cfstr(s: &str) -> CFString {
    CFString::new(s)
}

fn attribute(element: &CFType, name: &str) -> Option<CFType> {
    let mut value: CFTypeRef = std::ptr::null();
    let err = unsafe {
        AXUIElementCopyAttributeValue(
            element.as_CFTypeRef(),
            cfstr(name).as_concrete_TypeRef(),
            &mut value,
        )
    };
    if err != 0 || value.is_null() {
        return None;
    }
    Some(unsafe { CFType::wrap_under_create_rule(value) })
}

fn set_attribute(element: &CFType, name: &str, value: CFTypeRef) -> DesktopResult<()> {
    let err = unsafe {
        AXUIElementSetAttributeValue(
            element.as_CFTypeRef(),
            cfstr(name).as_concrete_TypeRef(),
            value,
        )
    };
    if err == 0 {
        Ok(())
    } else {
        Err(format!(
            "the window refused ({name}, accessibility error {err})"
        ))
    }
}

fn perform_action(element: &CFType, name: &str) -> DesktopResult<()> {
    let err = unsafe {
        AXUIElementPerformAction(element.as_CFTypeRef(), cfstr(name).as_concrete_TypeRef())
    };
    if err == 0 {
        Ok(())
    } else {
        Err(format!(
            "the window refused ({name}, accessibility error {err})"
        ))
    }
}

fn ax_point(element: &CFType, name: &str) -> Option<Point> {
    let value = attribute(element, name)?;
    let mut point = Point::default();
    unsafe {
        AXValueGetValue(
            value.as_CFTypeRef(),
            AX_POINT,
            &mut point as *mut Point as *mut c_void,
        )
    }
    .then_some(point)
}

fn ax_size(element: &CFType, name: &str) -> Option<Size> {
    let value = attribute(element, name)?;
    let mut size = Size::default();
    unsafe {
        AXValueGetValue(
            value.as_CFTypeRef(),
            AX_SIZE,
            &mut size as *mut Size as *mut c_void,
        )
    }
    .then_some(size)
}

fn set_point(element: &CFType, name: &str, point: Point) -> DesktopResult<()> {
    let value = unsafe {
        CFType::wrap_under_create_rule(AXValueCreate(
            AX_POINT,
            &point as *const Point as *const c_void,
        ))
    };
    set_attribute(element, name, value.as_CFTypeRef())
}

fn set_size(element: &CFType, name: &str, size: Size) -> DesktopResult<()> {
    let value = unsafe {
        CFType::wrap_under_create_rule(AXValueCreate(
            AX_SIZE,
            &size as *const Size as *const c_void,
        ))
    };
    set_attribute(element, name, value.as_CFTypeRef())
}

fn ax_string(element: &CFType, name: &str) -> Option<String> {
    attribute(element, name)?
        .downcast::<CFString>()
        .map(|s| s.to_string())
}

fn ax_bool(element: &CFType, name: &str) -> bool {
    attribute(element, name)
        .and_then(|v| v.downcast::<CFBoolean>())
        .map(bool::from)
        .unwrap_or(false)
}

fn application(pid: i32) -> CFType {
    unsafe { CFType::wrap_under_create_rule(AXUIElementCreateApplication(pid)) }
}

fn window_number(element: &CFType) -> Option<u32> {
    let mut id: u32 = 0;
    (unsafe { _AXUIElementGetWindow(element.as_CFTypeRef(), &mut id) } == 0).then_some(id)
}

fn windows_of(app: &CFType) -> Vec<CFType> {
    let Some(value) = attribute(app, "AXWindows") else {
        return Vec::new();
    };
    if value.type_of() != CFArray::<CFType>::type_id() {
        return Vec::new();
    }
    let array: CFArray<CFType> =
        unsafe { CFArray::wrap_under_get_rule(value.as_CFTypeRef() as CFArrayRef) };
    array.iter().map(|item| item.clone()).collect()
}

fn describe(pid: i32, app_name: &str, element: &CFType, index: usize) -> WindowInfo {
    describe_with(pid, app_name, element, index, &screens().unwrap_or_default())
}

fn describe_with(pid: i32, app_name: &str, element: &CFType, index: usize, screens: &[ScreenInfo]) -> WindowInfo {
    let id = window_number(element).map(|n| n.to_string()).unwrap_or_else(|| format!("i{index}"));
    let position = ax_point(element, "AXPosition").unwrap_or_default();
    let size = ax_size(element, "AXSize").unwrap_or_default();
    let (x, y) = (position.x.round() as i32, position.y.round() as i32);
    let (width, height) = (size.width.round() as i32, size.height.round() as i32);
    WindowInfo {
        handle: format!("{HANDLE_PREFIX}{pid}-{id}"),
        title: ax_string(element, "AXTitle").unwrap_or_default(),
        app: app_name.to_string(),
        x,
        y,
        width,
        height,
        screen: super::screen_of(screens, x, y, width, height).map(|s| s.number).unwrap_or(0),
        minimized: ax_bool(element, "AXMinimized"),
    }
}

/// The displays in the windows' coordinate space: the main one first, then left to right, top to bottom.
pub fn screens() -> DesktopResult<Vec<ScreenInfo>> {
    let main = CGDisplay::main().id;
    let ids = CGDisplay::active_displays().map_err(|e| format!("could not list the displays: {e:?}"))?;
    let mut list: Vec<ScreenInfo> = ids
        .into_iter()
        .map(|id| {
            let display = CGDisplay::new(id);
            let b = display.bounds();
            let pixels = display.pixels_wide() as f64;
            let scale = if b.size.width > 0.0 { (pixels / b.size.width * 100.0).round() / 100.0 } else { 1.0 };
            let mm = display.screen_size();
            let dpi = if mm.width > 0.0 { (pixels / (mm.width / 25.4)).round() as u32 } else { 0 };
            ScreenInfo { number: 0, x: b.origin.x.round() as i32, y: b.origin.y.round() as i32, width: b.size.width.round() as i32, height: b.size.height.round() as i32, scale, dpi, primary: id == main }
        })
        .collect();
    list.sort_by_key(|s| (!s.primary, s.x, s.y));
    for (i, s) in list.iter_mut().enumerate() {
        s.number = i as u32 + 1;
    }
    Ok(list)
}

fn trusted() -> DesktopResult<()> {
    if unsafe { AXIsProcessTrusted() } {
        Ok(())
    } else {
        Err("Lunchpad needs the Accessibility permission to control windows (System Settings → Privacy & Security → Accessibility)".into())
    }
}

/// Regular programs (the ones with a Dock icon) as (pid, name).
fn programs() -> Vec<(i32, String)> {
    let workspace = NSWorkspace::sharedWorkspace();
    let apps = workspace.runningApplications();
    apps.iter()
        .filter(|app| app.activationPolicy() == NSApplicationActivationPolicy::Regular)
        .map(|app| {
            (
                app.processIdentifier(),
                app.localizedName()
                    .map(|n| n.to_string())
                    .unwrap_or_default(),
            )
        })
        .collect()
}

fn program_name(pid: i32) -> String {
    NSRunningApplication::runningApplicationWithProcessIdentifier(pid)
        .and_then(|app| app.localizedName().map(|n| n.to_string()))
        .unwrap_or_default()
}

pub fn list() -> DesktopResult<Vec<WindowInfo>> {
    trusted()?;
    let mut out = Vec::new();
    let screens = screens().unwrap_or_default();
    for (pid, name) in programs() {
        let app = application(pid);
        for (index, element) in windows_of(&app).iter().enumerate() {
            let info = describe_with(pid, &name, element, index, &screens);
            // Untitled windows are the desktop, tooltips and status bubbles: nothing a macro would target.
            if info.title.is_empty() {
                continue;
            }
            if info.width > 0 && info.height > 0 {
                out.push(info);
            }
        }
    }
    Ok(out)
}

pub fn foreground() -> DesktopResult<Option<WindowInfo>> {
    trusted()?;
    let workspace = NSWorkspace::sharedWorkspace();
    let Some(front) = workspace.frontmostApplication() else {
        return Ok(None);
    };
    let pid = front.processIdentifier();
    let name = front
        .localizedName()
        .map(|n| n.to_string())
        .unwrap_or_default();
    let app = application(pid);
    let Some(focused) = attribute(&app, "AXFocusedWindow") else {
        return Ok(None);
    };
    let index = windows_of(&app)
        .iter()
        .position(|w| w.as_CFTypeRef() == focused.as_CFTypeRef())
        .unwrap_or(0);
    Ok(Some(describe(pid, &name, &focused, index)))
}

/// The element behind a handle, with its program's pid.
fn resolve(handle: &str) -> DesktopResult<Option<(i32, CFType)>> {
    trusted()?;
    let rest = handle
        .strip_prefix(HANDLE_PREFIX)
        .ok_or_else(|| format!("not a window handle: {handle}"))?;
    let (pid, id) = rest
        .split_once('-')
        .ok_or_else(|| format!("not a window handle: {handle}"))?;
    let pid: i32 = pid
        .parse()
        .map_err(|_| format!("not a window handle: {handle}"))?;
    let app = application(pid);
    let windows = windows_of(&app);
    let found = match id.strip_prefix('i') {
        Some(index) => index
            .parse::<usize>()
            .ok()
            .and_then(|i| windows.get(i).cloned()),
        None => {
            let number: u32 = id
                .parse()
                .map_err(|_| format!("not a window handle: {handle}"))?;
            windows
                .into_iter()
                .find(|w| window_number(w) == Some(number))
        }
    };
    Ok(found.map(|w| (pid, w)))
}

pub fn by_handle(handle: &str) -> DesktopResult<Option<WindowInfo>> {
    Ok(resolve(handle)?.map(|(pid, element)| {
        let index = windows_of(&application(pid))
            .iter()
            .position(|w| w.as_CFTypeRef() == element.as_CFTypeRef())
            .unwrap_or(0);
        describe(pid, &program_name(pid), &element, index)
    }))
}

pub fn perform(window: &WindowInfo, op: Op) -> DesktopResult<()> {
    let Some((pid, element)) = resolve(&window.handle)? else {
        return Err(format!("the window “{}” is gone", window.title));
    };
    let running = NSRunningApplication::runningApplicationWithProcessIdentifier(pid);
    match op {
        Op::Focus => {
            if ax_bool(&element, "AXMinimized") {
                set_attribute(
                    &element,
                    "AXMinimized",
                    CFBoolean::false_value().as_CFTypeRef(),
                )?;
            }
            perform_action(&element, "AXRaise")?;
            if let Some(app) = running {
                app.activateWithOptions(NSApplicationActivationOptions::empty());
            }
            Ok(())
        }
        Op::Minimize => set_attribute(
            &element,
            "AXMinimized",
            CFBoolean::true_value().as_CFTypeRef(),
        ),
        Op::Restore => {
            set_attribute(
                &element,
                "AXMinimized",
                CFBoolean::false_value().as_CFTypeRef(),
            )?;
            perform_action(&element, "AXRaise")
        }
        Op::Maximize => {
            // macOS has no maximized state short of full screen: fill the window's display below the menu bar.
            let (x, y, width, height) = screens()
                .ok()
                .and_then(|list| list.into_iter().find(|s| s.number == window.screen))
                .map(|s| (s.x as f64, s.y as f64, s.width as f64, s.height as f64))
                .unwrap_or_else(|| {
                    let b = CGDisplay::main().bounds();
                    (b.origin.x, b.origin.y, b.size.width, b.size.height)
                });
            set_point(&element, "AXPosition", Point { x, y: y + MENU_BAR })?;
            set_size(&element, "AXSize", Size { width, height: height - MENU_BAR })
        }
        // A single window cannot be lowered on its own; hiding the program puts all of its windows behind the others.
        Op::SendToBack => match running {
            Some(app) => {
                app.hide();
                Ok(())
            }
            None => Err("the program is gone".into()),
        },
        Op::Close => {
            let button = attribute(&element, "AXCloseButton")
                .ok_or_else(|| "the window has no close button".to_string())?;
            perform_action(&button, "AXPress")
        }
        Op::Move { x, y } => set_point(
            &element,
            "AXPosition",
            Point {
                x: x as f64,
                y: y as f64,
            },
        ),
        Op::Resize { width, height } => set_size(
            &element,
            "AXSize",
            Size {
                width: width.max(1) as f64,
                height: height.max(1) as f64,
            },
        ),
        Op::Bounds { x, y, width, height } => {
            set_point(&element, "AXPosition", Point { x: x as f64, y: y as f64 })?;
            set_size(&element, "AXSize", Size { width: width.max(1) as f64, height: height.max(1) as f64 })
        }
    }
}

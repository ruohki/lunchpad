//! Windows: Win32 window handles. Every visible, titled, uncloaked top-level
//! window of another program counts.

use super::{DesktopResult, Op, ScreenInfo, WindowInfo, HANDLE_PREFIX};
use std::ffi::c_void;
use windows::core::{BOOL, PWSTR};
use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, RECT, WPARAM};
use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
use windows::Win32::Graphics::Gdi::{EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFOEXW};
use windows::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI, MDT_RAW_DPI};

/// `MONITORINFO.dwFlags` bit for the primary monitor (the `windows` crate leaves it out).
const MONITORINFOF_PRIMARY: u32 = 1;
use windows::Win32::System::Threading::{
    AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW,
    PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetForegroundWindow, GetWindowLongPtrW, GetWindowRect, GetWindowTextLengthW,
    GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible, PostMessageW,
    SetForegroundWindow, SetWindowPos, ShowWindow, GWL_EXSTYLE, HWND_BOTTOM, SWP_NOACTIVATE,
    SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SW_MAXIMIZE, SW_MINIMIZE, SW_RESTORE, WM_CLOSE,
    WS_EX_TOOLWINDOW,
};

unsafe extern "system" fn collect(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let list = &mut *(lparam.0 as *mut Vec<HWND>);
    list.push(hwnd);
    BOOL::from(true)
}

fn handle_of(hwnd: HWND) -> String {
    format!("{HANDLE_PREFIX}{}", hwnd.0 as usize)
}

fn hwnd_of(handle: &str) -> DesktopResult<HWND> {
    handle
        .strip_prefix(HANDLE_PREFIX)
        .and_then(|n| n.parse::<usize>().ok())
        .map(|n| HWND(n as *mut c_void))
        .ok_or_else(|| format!("not a window handle: {handle}"))
}

fn title_of(hwnd: HWND) -> String {
    let len = unsafe { GetWindowTextLengthW(hwnd) };
    if len <= 0 {
        return String::new();
    }
    let mut buf = vec![0u16; len as usize + 1];
    let n = unsafe { GetWindowTextW(hwnd, &mut buf) };
    String::from_utf16_lossy(&buf[..n.max(0) as usize])
}

fn program_of(hwnd: HWND) -> String {
    let mut pid: u32 = 0;
    unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
    if pid == 0 {
        return String::new();
    }
    let Ok(process) = (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) })
    else {
        return String::new();
    };
    let mut buf = [0u16; 1024];
    let mut len = buf.len() as u32;
    let ok = unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_FORMAT(0),
            PWSTR(buf.as_mut_ptr()),
            &mut len,
        )
    }
    .is_ok();
    let _ = unsafe { CloseHandle(process) };
    if !ok {
        return String::new();
    }
    let path = String::from_utf16_lossy(&buf[..len as usize]);
    std::path::Path::new(&path)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or(path)
}

fn cloaked(hwnd: HWND) -> bool {
    let mut value: u32 = 0;
    unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            &mut value as *mut u32 as *mut c_void,
            std::mem::size_of::<u32>() as u32,
        )
    }
    .is_ok()
        && value != 0
}

fn counts(hwnd: HWND) -> bool {
    if !unsafe { IsWindowVisible(hwnd) }.as_bool() || cloaked(hwnd) {
        return false;
    }
    let style = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) } as u32;
    if style & WS_EX_TOOLWINDOW.0 != 0 {
        return false;
    }
    (unsafe { GetWindowTextLengthW(hwnd) }) > 0
}

fn describe(hwnd: HWND) -> WindowInfo {
    describe_with(hwnd, &screens().unwrap_or_default())
}

fn describe_with(hwnd: HWND, screens: &[ScreenInfo]) -> WindowInfo {
    let mut rect = RECT::default();
    let _ = unsafe { GetWindowRect(hwnd, &mut rect) };
    let (width, height) = (rect.right - rect.left, rect.bottom - rect.top);
    WindowInfo {
        handle: handle_of(hwnd),
        title: title_of(hwnd),
        app: program_of(hwnd),
        x: rect.left,
        y: rect.top,
        width,
        height,
        screen: super::screen_of(screens, rect.left, rect.top, width, height).map(|s| s.number).unwrap_or(0),
        minimized: unsafe { IsIconic(hwnd) }.as_bool(),
    }
}

unsafe extern "system" fn collect_monitors(monitor: HMONITOR, _dc: HDC, _rect: *mut RECT, lparam: LPARAM) -> BOOL {
    let list = &mut *(lparam.0 as *mut Vec<HMONITOR>);
    list.push(monitor);
    BOOL::from(true)
}

/// The monitors, numbered as the display settings number them (`\\.\DISPLAY2` is screen 2).
pub fn screens() -> DesktopResult<Vec<ScreenInfo>> {
    let mut monitors: Vec<HMONITOR> = Vec::new();
    let ok = unsafe { EnumDisplayMonitors(None, None, Some(collect_monitors), LPARAM(&mut monitors as *mut Vec<HMONITOR> as isize)) };
    if !ok.as_bool() {
        return Err("could not list the displays".into());
    }
    let mut list = Vec::new();
    for (i, monitor) in monitors.into_iter().enumerate() {
        let mut info = MONITORINFOEXW::default();
        info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
        if !unsafe { GetMonitorInfoW(monitor, &mut info.monitorInfo) }.as_bool() {
            continue;
        }
        let device = String::from_utf16_lossy(&info.szDevice);
        let number = device.trim_end_matches('\0').rsplit("DISPLAY").next().and_then(|n| n.parse::<u32>().ok()).unwrap_or(i as u32 + 1);
        let r = info.monitorInfo.rcMonitor;
        let dpi_of = |kind| {
            let (mut x, mut y) = (0u32, 0u32);
            unsafe { GetDpiForMonitor(monitor, kind, &mut x, &mut y) }.ok().map(|_| x)
        };
        let scale = dpi_of(MDT_EFFECTIVE_DPI).map(|d| (d as f64 / 96.0 * 100.0).round() / 100.0).unwrap_or(1.0);
        let dpi = dpi_of(MDT_RAW_DPI).unwrap_or(0);
        list.push(ScreenInfo { number, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top, scale, dpi, primary: info.monitorInfo.dwFlags & MONITORINFOF_PRIMARY != 0 });
    }
    list.sort_by_key(|s| s.number);
    Ok(list)
}

pub fn list() -> DesktopResult<Vec<WindowInfo>> {
    let mut all: Vec<HWND> = Vec::new();
    unsafe { EnumWindows(Some(collect), LPARAM(&mut all as *mut Vec<HWND> as isize)) }
        .map_err(|e| format!("could not list windows: {e}"))?;
    let screens = screens().unwrap_or_default();
    Ok(all.into_iter().filter(|h| counts(*h)).map(|h| describe_with(h, &screens)).collect())
}

pub fn foreground() -> DesktopResult<Option<WindowInfo>> {
    let hwnd = unsafe { GetForegroundWindow() };
    Ok((!hwnd.0.is_null()).then(|| describe(hwnd)))
}

pub fn by_handle(handle: &str) -> DesktopResult<Option<WindowInfo>> {
    let hwnd = hwnd_of(handle)?;
    Ok(unsafe { IsWindow(Some(hwnd)) }
        .as_bool()
        .then(|| describe(hwnd)))
}

pub fn perform(window: &WindowInfo, op: Op) -> DesktopResult<()> {
    let hwnd = hwnd_of(&window.handle)?;
    if !unsafe { IsWindow(Some(hwnd)) }.as_bool() {
        return Err(format!("the window “{}” is gone", window.title));
    }
    let fail = |what: &str| format!("could not {what} “{}”", window.title);
    match op {
        Op::Focus => {
            if unsafe { IsIconic(hwnd) }.as_bool() {
                let _ = unsafe { ShowWindow(hwnd, SW_RESTORE) };
            }
            // Windows only lets the thread that owns the input bring a window forward; borrow it.
            let front = unsafe { GetForegroundWindow() };
            let front_thread = unsafe { GetWindowThreadProcessId(front, None) };
            let me = unsafe { GetCurrentThreadId() };
            let attached = front_thread != 0
                && front_thread != me
                && unsafe { AttachThreadInput(front_thread, me, true) }.as_bool();
            let ok = unsafe { SetForegroundWindow(hwnd) }.as_bool();
            if attached {
                let _ = unsafe { AttachThreadInput(front_thread, me, false) };
            }
            ok.then_some(()).ok_or_else(|| fail("bring forward"))
        }
        Op::Minimize => {
            let _ = unsafe { ShowWindow(hwnd, SW_MINIMIZE) };
            Ok(())
        }
        Op::Maximize => {
            let _ = unsafe { ShowWindow(hwnd, SW_MAXIMIZE) };
            Ok(())
        }
        Op::Restore => {
            let _ = unsafe { ShowWindow(hwnd, SW_RESTORE) };
            Ok(())
        }
        Op::SendToBack => unsafe {
            SetWindowPos(
                hwnd,
                Some(HWND_BOTTOM),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            )
        }
        .map_err(|_| fail("send back")),
        Op::Close => unsafe { PostMessageW(Some(hwnd), WM_CLOSE, WPARAM(0), LPARAM(0)) }
            .map_err(|_| fail("close")),
        Op::Move { x, y } => unsafe {
            SetWindowPos(
                hwnd,
                None,
                x,
                y,
                0,
                0,
                SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
            )
        }
        .map_err(|_| fail("move")),
        Op::Resize { width, height } => unsafe {
            SetWindowPos(
                hwnd,
                None,
                0,
                0,
                width.max(1),
                height.max(1),
                SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE,
            )
        }
        .map_err(|_| fail("resize")),
        Op::Bounds { x, y, width, height } => unsafe { SetWindowPos(hwnd, None, x, y, width.max(1), height.max(1), SWP_NOZORDER | SWP_NOACTIVATE) }.map_err(|_| fail("move and resize")),
    }
}

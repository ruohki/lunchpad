use super::{DesktopResult, Op, ScreenInfo, WindowInfo};

const MESSAGE: &str = "window control is not available on this system";

pub fn list() -> DesktopResult<Vec<WindowInfo>> {
    Err(MESSAGE.into())
}
pub fn foreground() -> DesktopResult<Option<WindowInfo>> {
    Err(MESSAGE.into())
}
pub fn by_handle(_handle: &str) -> DesktopResult<Option<WindowInfo>> {
    Err(MESSAGE.into())
}
pub fn perform(_window: &WindowInfo, _op: Op) -> DesktopResult<()> {
    Err(MESSAGE.into())
}
pub fn screens() -> DesktopResult<Vec<ScreenInfo>> {
    Err(MESSAGE.into())
}

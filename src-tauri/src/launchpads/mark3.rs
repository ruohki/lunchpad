/**
 * Definitions & Helper functions for:
 * Launchpad Mini MK3
 * Launchpad X
 * Launchpad Pro MK3
 */
#[warn(non_upper_case_globals)]
pub static MINIMK3_MODE: [u8; 4]    = [0x02, 0x0D, 0x00, 0x7F];
pub static MINIMK3_UNLOAD: [u8; 4]  = [0x02, 0x0D, 0x00, 0x04];
pub static MINIMK3_COLOR: [u8; 3]   = [0x02, 0x0D, 0x03];

pub static LPX_MODE: [u8; 4]        = [0x02, 0x0C, 0x0E, 0x01];
pub static LPX_LAYOUT: [u8; 4]      = [0x02, 0x0C, 0x00, 0x7F];
pub static LPX_UNLOAD: [u8; 4]      = [0x02, 0x0C, 0x00, 0x01];
pub static LPX_COLOR: [u8; 3]       = [0x02, 0x0C, 0x03];

pub static PROMK3_MODE: [u8; 4]     = [0x02, 0x0E, 0x0E, 0x01];
pub static PROMK3_UNLOAD: [u8; 4]   = [0x02, 0x0E, 0x0E, 0x00];
pub static PROMK3_COLOR: [u8; 3]    = [0x02, 0x0E, 0x03];
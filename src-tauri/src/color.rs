use serde::{Serialize, Deserialize};

pub const INDEX_COLOR_PALETTE: [&'static str; 128] = [
  "#000000", "#1c1c1c", "#7c7c7c", "#fcfcfc", "#fc4848", "#fc0000", "#540000", "#180000",
  "#fcb868", "#fc5000", "#541c00", "#241800", "#fcfc48", "#fcfc00", "#545400", "#181800",
  "#84fc48", "#50fc00", "#1c5400", "#102800", "#48fc48", "#00fc00", "#005400", "#001800",
  "#48fc5c", "#00fc18", "#00540c", "#001900", "#48fc84", "#00fc54", "#00541c", "#001c10",
  "#48fcb4", "#00fc94", "#005534", "#001810", "#48c0fc", "#00a4fc", "#004050", "#000c18",
  "#4884fc", "#0054fc", "#001c54", "#000418", "#4848fc", "#0000fd", "#000054", "#000018",
  "#8448fc", "#5000fc", "#180060", "#0c002c", "#fc48fc", "#fc00fc", "#540054", "#180018",
  "#fc4884", "#fc0050", "#54001c", "#200010", "#fc1400", "#943400", "#745000", "#406000",
  "#003800", "#005434", "#00507c", "#0000fc", "#00444c", "#2400c8", "#7d7d7d", "#1d1d1d",
  "#fd0000", "#b8fc2c", "#ace804", "#60fc08", "#0c8800", "#00fc84", "#00a5fc", "#0028fc",
  "#3c00fc", "#7800fc", "#ac1878", "#3c2000", "#fc4800", "#84dc04", "#70fc14", "#00fd00",
  "#38fc24", "#54fc6c", "#34fcc8", "#5888fc", "#3050c0", "#847ce4", "#d01cfc", "#fc0058",
  "#fc7c00", "#b5ac00", "#8cfc00", "#805804", "#382800", "#10480c", "#0c4c34", "#141428",
  "#141c58", "#643818", "#a40008", "#d8503c", "#d46818", "#fcdc24", "#9cdc2c", "#64b00c",
  "#1c1c2c", "#d8fc68", "#7cfcb8", "#9894fc", "#8c64fc", "#3c3c3c", "#707070", "#dcfcfc",
  "#9c0000", "#340000", "#18cc00", "#044000", "#b4ac00", "#3c3000", "#b05c00", "#481400",
];

pub type RGBTuple = (u8, u8, u8);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchpadSolidColor(u8);
impl LaunchpadSolidColor {
  pub fn to_string(&self) -> String {
    let index = usize::from(if self.0 > 128u8 { self.0 - 128u8 } else { self.0 });

    INDEX_COLOR_PALETTE[index].to_string()
  }

  pub fn to_rgb(&self) -> RGBTuple {
    let color = self.to_string();
    let cleaned = color.replace("#", "");

    if cleaned.len() != 6 {
      return (0,0,0);
    }

    hex::decode(cleaned).map(
      |bytes| (bytes[0], bytes[1], bytes[2])
    ).unwrap()
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchpadFlashingColor(u8, u8);
impl LaunchpadFlashingColor {
  pub fn to_string(&self) -> (String, String) {
    let color1 = LaunchpadSolidColor(self.0);
    let color2 = LaunchpadSolidColor(self.1);

    (color1.to_string(), color2.to_string())
  }
  pub fn to_rgb(&self) -> (RGBTuple, RGBTuple) {
    let color1 = LaunchpadSolidColor(self.0);
    let color2 = LaunchpadSolidColor(self.1);

    (color1.to_rgb(), color2.to_rgb())
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchpadPulsingColor(u8);
impl LaunchpadPulsingColor {
  pub fn to_string(&self) -> String {
    let color = LaunchpadSolidColor(self.0);
    color.to_string()
  }
  pub fn to_rgb(&self) -> RGBTuple {
    let color = LaunchpadSolidColor(self.0);
    color.to_rgb()
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchpadRGBColor(u8, u8, u8);
impl LaunchpadRGBColor {
  pub fn from_hex(hex: &str) -> Self {
    let cleaned = hex.replace("#", "");

    if cleaned.len() != 6 {
      return LaunchpadRGBColor(0,0,0);
    }

    hex::decode(cleaned).map(
      |bytes| LaunchpadRGBColor(bytes[0], bytes[1], bytes[2])
    ).unwrap()
  }

  pub fn to_string(&self) -> String {
    format!("#{:02X?}{:02X?}{:02X?}", self.0, self.1, self.2)
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LaunchpadButtonColor {
  Solid(LaunchpadSolidColor),
  Flashing(LaunchpadFlashingColor),
  Pulsing(LaunchpadPulsingColor),
  RGB(LaunchpadRGBColor)
}
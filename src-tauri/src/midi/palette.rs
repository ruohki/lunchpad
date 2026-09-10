//! Novation's 128-entry LED colour palette (index → RGB), shared by every RGB
//! Launchpad. Copied from the legacy app; the same table lives in `src/lib/palette.ts`.

use crate::midi::types::Color;

pub const NOVATION_PALETTE: [Color; 128] = [
    Color::new(0, 0, 0), // 0
    Color::new(28, 28, 28), // 1
    Color::new(124, 124, 124), // 2
    Color::new(252, 252, 252), // 3
    Color::new(252, 72, 72), // 4
    Color::new(252, 0, 0), // 5
    Color::new(84, 0, 0), // 6
    Color::new(24, 0, 0), // 7
    Color::new(252, 184, 104), // 8
    Color::new(252, 80, 0), // 9
    Color::new(84, 28, 0), // 10
    Color::new(36, 24, 0), // 11
    Color::new(252, 252, 72), // 12
    Color::new(252, 252, 0), // 13
    Color::new(84, 84, 0), // 14
    Color::new(24, 24, 0), // 15
    Color::new(132, 252, 72), // 16
    Color::new(80, 252, 0), // 17
    Color::new(28, 84, 0), // 18
    Color::new(16, 40, 0), // 19
    Color::new(72, 252, 72), // 20
    Color::new(0, 252, 0), // 21
    Color::new(0, 84, 0), // 22
    Color::new(0, 24, 0), // 23
    Color::new(72, 252, 92), // 24
    Color::new(0, 252, 24), // 25
    Color::new(0, 84, 12), // 26
    Color::new(0, 25, 0), // 27
    Color::new(72, 252, 132), // 28
    Color::new(0, 252, 84), // 29
    Color::new(0, 84, 28), // 30
    Color::new(0, 28, 16), // 31
    Color::new(72, 252, 180), // 32
    Color::new(0, 252, 148), // 33
    Color::new(0, 85, 52), // 34
    Color::new(0, 24, 16), // 35
    Color::new(72, 192, 252), // 36
    Color::new(0, 164, 252), // 37
    Color::new(0, 64, 80), // 38
    Color::new(0, 12, 24), // 39
    Color::new(72, 132, 252), // 40
    Color::new(0, 84, 252), // 41
    Color::new(0, 28, 84), // 42
    Color::new(0, 4, 24), // 43
    Color::new(72, 72, 252), // 44
    Color::new(0, 0, 253), // 45
    Color::new(0, 0, 84), // 46
    Color::new(0, 0, 24), // 47
    Color::new(132, 72, 252), // 48
    Color::new(80, 0, 252), // 49
    Color::new(24, 0, 96), // 50
    Color::new(12, 0, 44), // 51
    Color::new(252, 72, 252), // 52
    Color::new(252, 0, 252), // 53
    Color::new(84, 0, 84), // 54
    Color::new(24, 0, 24), // 55
    Color::new(252, 72, 132), // 56
    Color::new(252, 0, 80), // 57
    Color::new(84, 0, 28), // 58
    Color::new(32, 0, 16), // 59
    Color::new(252, 20, 0), // 60
    Color::new(148, 52, 0), // 61
    Color::new(116, 80, 0), // 62
    Color::new(64, 96, 0), // 63
    Color::new(0, 56, 0), // 64
    Color::new(0, 84, 52), // 65
    Color::new(0, 80, 124), // 66
    Color::new(0, 0, 252), // 67
    Color::new(0, 68, 76), // 68
    Color::new(36, 0, 200), // 69
    Color::new(125, 125, 125), // 70
    Color::new(29, 29, 29), // 71
    Color::new(253, 0, 0), // 72
    Color::new(184, 252, 44), // 73
    Color::new(172, 232, 4), // 74
    Color::new(96, 252, 8), // 75
    Color::new(12, 136, 0), // 76
    Color::new(0, 252, 132), // 77
    Color::new(0, 165, 252), // 78
    Color::new(0, 40, 252), // 79
    Color::new(60, 0, 252), // 80
    Color::new(120, 0, 252), // 81
    Color::new(172, 24, 120), // 82
    Color::new(60, 32, 0), // 83
    Color::new(252, 72, 0), // 84
    Color::new(132, 220, 4), // 85
    Color::new(112, 252, 20), // 86
    Color::new(0, 253, 0), // 87
    Color::new(56, 252, 36), // 88
    Color::new(84, 252, 108), // 89
    Color::new(52, 252, 200), // 90
    Color::new(88, 136, 252), // 91
    Color::new(48, 80, 192), // 92
    Color::new(132, 124, 228), // 93
    Color::new(208, 28, 252), // 94
    Color::new(252, 0, 88), // 95
    Color::new(252, 124, 0), // 96
    Color::new(181, 172, 0), // 97
    Color::new(140, 252, 0), // 98
    Color::new(128, 88, 4), // 99
    Color::new(56, 40, 0), // 100
    Color::new(16, 72, 12), // 101
    Color::new(12, 76, 52), // 102
    Color::new(20, 20, 40), // 103
    Color::new(20, 28, 88), // 104
    Color::new(100, 56, 24), // 105
    Color::new(164, 0, 8), // 106
    Color::new(216, 80, 60), // 107
    Color::new(212, 104, 24), // 108
    Color::new(252, 220, 36), // 109
    Color::new(156, 220, 44), // 110
    Color::new(100, 176, 12), // 111
    Color::new(28, 28, 44), // 112
    Color::new(216, 252, 104), // 113
    Color::new(124, 252, 184), // 114
    Color::new(152, 148, 252), // 115
    Color::new(140, 100, 252), // 116
    Color::new(60, 60, 60), // 117
    Color::new(112, 112, 112), // 118
    Color::new(220, 252, 252), // 119
    Color::new(156, 0, 0), // 120
    Color::new(52, 0, 0), // 121
    Color::new(24, 204, 0), // 122
    Color::new(4, 64, 0), // 123
    Color::new(180, 172, 0), // 124
    Color::new(60, 48, 0), // 125
    Color::new(176, 92, 0), // 126
    Color::new(72, 20, 0), // 127
];

/// Palette colour for an index; out-of-range indices are clamped.
pub fn palette_color(index: u8) -> Color {
    NOVATION_PALETTE[(index as usize).min(127)]
}

/// Index of the palette entry closest to `c` (Euclidean distance in RGB).
pub fn nearest_palette_index(c: Color) -> u8 {
    let mut best = 0usize;
    let mut best_d = u32::MAX;
    for (i, p) in NOVATION_PALETTE.iter().enumerate() {
        let d = (p.r as i32 - c.r as i32).pow(2) as u32
            + (p.g as i32 - c.g as i32).pow(2) as u32
            + (p.b as i32 - c.b as i32).pow(2) as u32;
        if d < best_d {
            best_d = d;
            best = i;
        }
    }
    best as u8
}

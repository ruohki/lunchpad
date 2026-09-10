# Logging System

This project uses the [tracing](https://docs.rs/tracing) crate for structured, hierarchical logging in the Rust backend.

## Log Levels

The logging system supports the following levels (from most to least verbose):
- **TRACE**: Very detailed information, typically only useful for diagnosing specific problems
- **DEBUG**: Detailed information for debugging purposes
- **INFO**: General informational messages about application progress
- **WARN**: Warning messages for potentially problematic situations
- **ERROR**: Error messages for serious problems

## Log Categories (Hierarchical Module Structure)

The application is organized into categories based on Rust module structure. This allows you to filter logs by subsystem:

### Current Categories

- **`lunchpad_lib`** - Root application (general/system logs)
  - **`lunchpad_lib::midi`** - All MIDI-related functionality
    - `lunchpad_lib::midi::manager` - MIDI connection management
    - `lunchpad_lib::midi::device` - Device scanning and identification
    - `lunchpad_lib::midi::launchpad` - Launchpad device abstraction
  - **`lunchpad_lib::commands`** - Tauri command handlers (API layer)

### Future Categories (Planned)

- **`lunchpad_lib::macros`** - Macro execution engine
- **`lunchpad_lib::audio`** - Audio playback system
- **`lunchpad_lib::hotkey`** - Hotkey monitoring and automation
- **`lunchpad_lib::script`** - Script launcher (Python, AHK, Node.js)

## Default Configuration

By default, the application logs at **INFO** level for application code and **WARN** level for dependencies like `midir`.

## Filtering by Category

You can control logging verbosity using the `RUST_LOG` environment variable with module paths as categories:

### Development (bun run tauri dev)

```bash
# Default (info level for app, warn for dependencies)
bun run tauri dev

# Enable ALL debug logs (entire app)
RUST_LOG=debug bun run tauri dev

# Enable trace logs (very verbose - shows every MIDI message sent)
RUST_LOG=trace bun run tauri dev

# ═══════════════════════════════════════════════════════════
# CATEGORY-BASED FILTERING (Most Useful)
# ═══════════════════════════════════════════════════════════

# Enable debug for MIDI category only
RUST_LOG=lunchpad_lib::midi=debug bun run tauri dev

# Enable debug for Commands category only
RUST_LOG=lunchpad_lib::commands=debug bun run tauri dev

# Mix multiple categories with different levels
RUST_LOG=lunchpad_lib::midi=debug,lunchpad_lib::commands=info bun run tauri dev

# Enable trace for MIDI, info for everything else
RUST_LOG=lunchpad_lib::midi=trace,info bun run tauri dev

# Very specific: debug only the MIDI manager sub-module
RUST_LOG=lunchpad_lib::midi::manager=debug bun run tauri dev

# ═══════════════════════════════════════════════════════════
# FUTURE EXAMPLES (when these modules are added)
# ═══════════════════════════════════════════════════════════

# Debug macro execution only
# RUST_LOG=lunchpad_lib::macros=debug bun run tauri dev

# Trace audio playback issues
# RUST_LOG=lunchpad_lib::audio=trace bun run tauri dev

# Debug MIDI + trace macros + info for everything else
# RUST_LOG=lunchpad_lib::midi=debug,lunchpad_lib::macros=trace,info bun run tauri dev
```

### Production Build

For production builds, set the environment variable before running:

```bash
# macOS/Linux
RUST_LOG=info ./target/release/lunchpad

# Windows (PowerShell)
$env:RUST_LOG="info"; .\target\release\lunchpad.exe
```

## Log Format

Logs include:
- **Timestamp**: When the event occurred
- **Level**: Log level (INFO, WARN, ERROR, etc.)
- **Target/Category**: Module path indicating the subsystem (e.g., `lunchpad_lib::midi::manager`)
- **Line Number**: Source file line number
- **Structured Fields**: Key-value pairs with contextual data
- **Message**: The log message

Example log output showing hierarchical categories:
```
2025-12-13T10:30:45.001234Z  INFO lunchpad_lib:45: Starting Lunchpad application
                                  └─ Category: lunchpad_lib (System/App)

2025-12-13T10:30:45.123456Z  INFO lunchpad_lib::midi::manager:380 input="Launchpad MK2" output="Launchpad MK2" model=LaunchpadMk2 verify=false: Connecting to Launchpad
                                  └─ Category: lunchpad_lib::midi (MIDI subsystem)

2025-12-13T10:30:46.234567Z  INFO lunchpad_lib::midi::manager:606 input="Launchpad MK2" output="Launchpad MK2" model=LaunchpadMk2: Successfully connected to Launchpad
                                  └─ Category: lunchpad_lib::midi (MIDI subsystem)

2025-12-13T10:31:15.456789Z  WARN lunchpad_lib::midi::manager:500 elapsed_secs=3.2s: Device inquiry timeout - device disconnected
                                  └─ Category: lunchpad_lib::midi (MIDI subsystem)

2025-12-13T10:31:18.567890Z  INFO lunchpad_lib::commands:45 command="select_launchpad": Handling Tauri command
                                  └─ Category: lunchpad_lib::commands (API layer)
```

### Category Filtering Examples

```bash
# Show ONLY MIDI logs
$ RUST_LOG=lunchpad_lib::midi=debug bun run tauri dev 2>&1 | grep "lunchpad_lib::midi"
2025-12-13T10:30:45.123456Z  INFO lunchpad_lib::midi::manager:380 input="Launchpad MK2": Connecting to Launchpad
2025-12-13T10:30:46.234567Z  INFO lunchpad_lib::midi::manager:606: Successfully connected to Launchpad

# Show ONLY Command layer logs
$ RUST_LOG=lunchpad_lib::commands=info bun run tauri dev 2>&1 | grep "lunchpad_lib::commands"
2025-12-13T10:31:18.567890Z  INFO lunchpad_lib::commands:45 command="select_launchpad": Handling command

# Show EVERYTHING from app (default)
$ RUST_LOG=info bun run tauri dev
2025-12-13T10:30:45.001234Z  INFO lunchpad_lib:45: Starting Lunchpad application
2025-12-13T10:30:45.123456Z  INFO lunchpad_lib::midi::manager:380: Connecting to Launchpad
2025-12-13T10:31:18.567890Z  INFO lunchpad_lib::commands:45: Handling command
```

## Key Logged Events by Category

### `lunchpad_lib` - System/Application
Module: Root application
```bash
RUST_LOG=lunchpad_lib=info
```
Events:
- `INFO`: Starting Lunchpad application
- `INFO`: Auto-connected to saved Launchpad device

### `lunchpad_lib::midi` - MIDI Subsystem
Module: All MIDI-related functionality
```bash
RUST_LOG=lunchpad_lib::midi=debug
```

#### Connection Management (`lunchpad_lib::midi::manager`)
- `INFO`: Connecting to Launchpad
- `INFO`: Successfully connected to Launchpad
- `INFO`: Disconnecting from Launchpad
- `ERROR`: Failed to send init sequence

#### Device Monitoring (`lunchpad_lib::midi::manager`)
- `INFO`: Saved Launchpad device is now available
- `INFO`: Auto-reconnect enabled, triggering reconnection
- `INFO`: Auto-reconnect successful
- `WARN`: Auto-reconnect failed, will retry
- `ERROR`: Failed to reconnect to saved device

#### Health Monitoring/Heartbeat (`lunchpad_lib::midi::manager`)
- `TRACE`: Received device inquiry response
- `TRACE`: Health check OK
- `DEBUG`: Monitoring flag set to true
- `WARN`: Device inquiry timeout - device disconnected
- `WARN`: Device disconnected - emitting event and enabling monitoring
- `ERROR`: MIDI health check failed
- `ERROR`: MIDI send error

#### Device Identification (`lunchpad_lib::midi::device`)
- `INFO`: Scanning for MIDI devices
- `DEBUG`: Found device, sending inquiry
- `WARN`: Firmware version mismatch

### `lunchpad_lib::commands` - API/Command Layer
Module: Tauri command handlers
```bash
RUST_LOG=lunchpad_lib::commands=debug
```
Events:
- `INFO`: Handling command
- `DEBUG`: Command parameters
- `ERROR`: Command execution failed

### Future Categories

#### `lunchpad_lib::macros` - Macro Execution (Planned)
- Macro trigger events
- Macro execution steps
- Error handling

#### `lunchpad_lib::audio` - Audio Playback (Planned)
- Audio device selection
- Playback start/stop
- Volume control

#### `lunchpad_lib::hotkey` - Hotkey System (Planned)
- Hotkey registration
- Key press detection
- Action triggering

## Logging in Code

When adding new log statements, use appropriate levels. The category is automatically determined by the module path:

```rust
// In src/midi/manager.rs - automatically categorized as lunchpad_lib::midi::manager

// Informational messages
tracing::info!("Connected to device");
tracing::info!(port = %port_name, "Scanning MIDI port");

// Warnings for recoverable issues
tracing::warn!("Device not found, retrying");
tracing::warn!(
    expected = "1.0",
    actual = "2.0",
    "Version mismatch"
);

// Errors for serious problems
tracing::error!(error = %e, "Failed to connect to device");

// Debug information for development
tracing::debug!(count = devices.len(), "Found MIDI devices");

// Very detailed trace information
tracing::trace!("Sending MIDI message");
```

The module location automatically determines the category:
- Code in `src/midi/manager.rs` → Category: `lunchpad_lib::midi::manager`
- Code in `src/commands.rs` → Category: `lunchpad_lib::commands`
- Code in `src/macros/executor.rs` → Category: `lunchpad_lib::macros::executor` (future)

## Structured Fields

The tracing crate supports structured logging with key-value pairs:

```rust
// Use %field for Display formatting
tracing::info!(port = %port_name, "Connecting");

// Use ?field for Debug formatting
tracing::debug!(config = ?config, "Loaded configuration");

// Use field = value for simple values
tracing::info!(count = 5, "Found devices");

// Multiple fields
tracing::info!(
    input = %input_port,
    output = %output_port,
    model = ?model,
    "Connecting to Launchpad"
);
```

## Using Tracing Spans for Complex Operations

For multi-step operations, use tracing spans to track execution:

```rust
#[tracing::instrument(name = "operation_name", skip(self))]
pub fn my_function(&mut self, param: String) -> Result<()> {
    tracing::info!("Starting operation");
    // ... operation code ...
    tracing::info!("Operation completed");
    Ok(())
}
```

This creates a span that tracks the entire function execution and shows entry/exit in logs when using debug/trace levels.

## Tips

1. **Organize by module**: Place related code in appropriate modules (midi, commands, macros, etc.)
2. **Use INFO for user-facing events**: Connection status, successful operations
3. **Use WARN for recoverable issues**: Retries, fallbacks, non-critical problems
4. **Use ERROR for failures**: Operations that failed and can't be recovered
5. **Use DEBUG for development**: Internal state, detailed flow control
6. **Use TRACE sparingly**: Only for very detailed debugging (e.g., heartbeat checks)

## Module Organization Guidelines for Future Development

When adding new features, create appropriate modules:

```
src/
├── lib.rs           → lunchpad_lib (System/App level)
├── midi/            → lunchpad_lib::midi (MIDI category)
│   ├── mod.rs
│   ├── manager.rs
│   ├── device.rs
│   └── launchpad.rs
├── commands.rs      → lunchpad_lib::commands (API category)
├── macros/          → lunchpad_lib::macros (Macro category - future)
│   ├── mod.rs
│   ├── executor.rs
│   └── storage.rs
├── audio/           → lunchpad_lib::audio (Audio category - future)
│   ├── mod.rs
│   ├── player.rs
│   └── devices.rs
├── hotkey/          → lunchpad_lib::hotkey (Hotkey category - future)
│   ├── mod.rs
│   └── monitor.rs
└── script/          → lunchpad_lib::script (Script category - future)
    ├── mod.rs
    └── launcher.rs
```

This structure automatically provides hierarchical logging categories.

## Performance

- Logging at TRACE level can impact performance due to the volume of messages
- In production, stick to INFO or WARN level
- Structured fields are zero-cost when the log level is disabled
- Categories are just fields and have negligible performance impact

import { LaunchApp } from '@lunchpad/types';
import { MacroAction } from './index';

const { spawn, ChildProcess } = window.require('child_process')

export class LaunchAppAction extends MacroAction {
  private action: LaunchApp;
  private cancel: boolean = false;

  private runner: typeof ChildProcess;

  constructor(action: LaunchApp) {
    super()
    this.action = action;
    this.id = action.id;
    this.wait = action.wait;
  }

  public async Run(): Promise<unknown> {
    return new Promise(resolve => {
      const args = this.action?.arguments?.split(" ") ?? ""
      this.runner = spawn(this.action.executable, args, {
        windowsHide: this.action.hidden,
        detached: process.platform != "win32"
      })
      const pid = this.runner.pid;

      console.log("Spawned process", pid);
      const onExit = (code, signal) => {
        console.log("Process", pid, "has exited. Code", code, "Signal", signal);
        resolve();
      }
      const onClosed = (code, signal) => console.log("Subprocess of", pid, "has exited. Code", code, "Signal", signal)
      const onStdOut = (data) => console.log(`Process ${pid}: ${data}`)
      const onStdErr = (data) => console.error(`Process ${pid}: ${data}`)

      this.runner.on('exit', onExit );
      this.runner.on('closed', onClosed);

      this.runner.stdout.on('data', onStdOut);
      this.runner.stderr.on('data', onStdErr);
      this.runner.unref();

      const handle = setInterval(() => {
        if (this.cancel) {
          this.runner.off('exit', onExit);
          this.runner.off('closed', onClosed);
          this.runner.stdout.off('data', onStdOut);
          this.runner.stderr.off('data', onStdErr);
          clearInterval(handle);
          resolve();
        }
      }, 1)
    })
  }

  public Stop() {
    if (this.action.killOnStop) {

      if (process.platform != "win32") {
        spawn("sh", ["-c", "kill -INT -"+this.runner.pid]);
      } else {
        this.runner.kill("SIGINT");
      }
      const pid = this.runner.pid;
      this.runner.kill();
      process.kill(pid);
    }

    this.cancel = true;
  }
}
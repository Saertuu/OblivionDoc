"""Windows entry point. Build with scripts/build_windows.ps1."""
import argparse
import json
import logging
import os
from pathlib import Path
import sys
import traceback


def main():
    parser = argparse.ArgumentParser(description="OblivionDoc")
    parser.add_argument("--data-dir", type=Path)
    parser.add_argument("--smoke-test", choices=["create", "verify"])
    parser.add_argument("--report", type=Path)
    parser.add_argument("--no-ui", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.data_dir:
        os.environ["OBLIVION_DATA_DIR"] = str(args.data_dir.resolve())
    from backend.paths import DATA_DIR
    logging.basicConfig(filename=DATA_DIR / "application.log", level=logging.INFO, encoding="utf-8", format="%(asctime)s %(levelname)s %(message)s")
    if sys.stdout is None:
        sys.stdout = open(DATA_DIR / "runtime.log", "a", encoding="utf-8", buffering=1)
    if sys.stderr is None:
        sys.stderr = sys.stdout
    runtime = None
    try:
        from desktop.runtime import Runtime
        runtime = Runtime()
        api = runtime.start()
        if args.smoke_test:
            if not args.report:
                raise ValueError("Smoke test requires --report")
            from desktop.smoke import run
            run(api, args.smoke_test, args.report, DATA_DIR, with_ui=not args.no_ui)
        else:
            import tkinter as tk
            from desktop.window import Window
            root = tk.Tk()
            try:
                icon = Path(getattr(sys, "_MEIPASS", Path(__file__).parent)) / "assets" / "obliviondoc.ico"
                if sys.platform == "win32" and icon.exists():
                    root.iconbitmap(str(icon))
            except tk.TclError:
                pass
            Window(root, api, DATA_DIR, runtime.close)
            root.mainloop()
        return 0
    except Exception as error:
        logging.exception("OblivionDoc failed")
        if args.smoke_test and args.report:
            args.report.write_text(json.dumps({"ok": False, "error": str(error), "traceback": traceback.format_exc()}, ensure_ascii=False, indent=2), encoding="utf-8")
        else:
            try:
                import ctypes
                if sys.platform == "win32":
                    ctypes.windll.user32.MessageBoxW(None, f"Не удалось запустить OblivionDoc.\n\n{error}\n\nЖурнал: {DATA_DIR / 'application.log'}", "OblivionDoc", 0x10)
                else:
                    print(traceback.format_exc(), file=sys.stderr)
            except Exception:
                pass
        return 1
    finally:
        if runtime:
            runtime.close()


if __name__ == "__main__":
    raise SystemExit(main())

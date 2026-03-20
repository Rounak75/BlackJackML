"""
╔══════════════════════════════════════════════════════════════════════╗
║        BlackjackML — Command-Line Entry Point                        ║
║                                                                      ║
║  This is the file you run to START the application.                  ║
║  It provides three commands:                                         ║
║                                                                      ║
║  1. python main.py web                                               ║
║     → Launches the live web dashboard at http://localhost:5000       ║
║       Open this in your browser to use the card counter.            ║
║                                                                      ║
║  2. python main.py simulate --hands 100000                           ║
║     → Runs a Monte Carlo simulation comparing:                       ║
║       • Basic strategy alone (flat bet)                              ║
║       • Basic strategy + card counting (bet spread)                  ║
║       • Full system (counting + Illustrious 18 deviations)          ║
║       Prints a report with house edge / player edge for each.        ║
║                                                                      ║
║  3. python main.py train --hands 500000 --epochs 50                  ║
║     → Trains the neural network decision model and saves it to       ║
║       models/best_model.pt. You must do this before the ML          ║
║       overlay in the dashboard shows meaningful results.            ║
║                                                                      ║
║  QUICK START FOR BEGINNERS:                                          ║
║  ─────────────────────────                                           ║
║  Step 1: pip install -r requirements.txt                             ║
║  Step 2: python main.py web                                          ║
║  Step 3: Open http://localhost:5000 in your browser                 ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import sys
import argparse


def main():
    """
    Parse command-line arguments and dispatch to the correct module.

    argparse is Python's built-in library for handling CLI arguments.
    subparsers allows different sub-commands (web, simulate, train)
    each with their own set of optional flags (--port, --hands, etc.).
    """

    # Create the top-level argument parser
    parser = argparse.ArgumentParser(
        description="BlackjackML — Live Card Counter & AI Advisor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EXAMPLES:
  python main.py web                         Start dashboard on port 5000
  python main.py web --port 8080             Start on custom port
  python main.py web --host 0.0.0.0          Allow LAN access
  python main.py simulate                    Quick 100k-hand validation
  python main.py simulate --hands 500000     Full validation (2-5 min)
  python main.py train                       Train with 500k hands
  python main.py train --hands 1000000       Full 1M hand training
  python main.py train --hands 100000 --epochs 20   Fast test training
        """
    )

    # Create sub-commands: web, simulate, train
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # ── "web" sub-command ─────────────────────────────────────────────
    # Starts the Flask + Socket.IO web server.
    # Access the dashboard at http://localhost:{port}
    web_parser = subparsers.add_parser(
        "web",
        help="Start the live web dashboard"
    )
    web_parser.add_argument(
        "--port", type=int, default=5000,
        help="Port number (default: 5000). Change if 5000 is already in use."
    )
    web_parser.add_argument(
        "--host", default="0.0.0.0",
        help="Host address. '0.0.0.0' allows access from other devices on your network."
    )
    web_parser.add_argument(
        "--debug", action="store_true",
        help="Enable Flask debug mode (auto-reload on code changes). DO NOT use in production."
    )

    # ── "simulate" sub-command ────────────────────────────────────────
    # Runs Monte Carlo simulations to validate strategy performance.
    # Produces a comparison table: basic strategy vs counting vs full system.
    sim_parser = subparsers.add_parser(
        "simulate",
        help="Run Monte Carlo strategy validation"
    )
    sim_parser.add_argument(
        "--hands", type=int, default=100000,
        help="Number of hands to simulate. More = more accurate results but slower. (default: 100000)"
    )

    # ── "train" sub-command ───────────────────────────────────────────
    # Generates training data via simulation, then trains the neural network.
    # Saves the best model checkpoint to models/best_model.pt
    train_parser = subparsers.add_parser(
        "train",
        help="Train the ML decision model"
    )
    train_parser.add_argument(
        "--hands", type=int, default=500000,
        help="Simulated hands for training data. More = higher accuracy but slower. (default: 500000)"
    )
    train_parser.add_argument(
        "--epochs", type=int, default=50,
        help="Training epochs. Each epoch is one full pass through the data. (default: 50)"
    )
    train_parser.add_argument(
        "--resume", action="store_true", default=False,
        help="Continue training from models/last_checkpoint.pt instead of starting fresh."
    )

    # Parse the arguments the user provided
    args = parser.parse_args()

    # If no command given, default to "web" (just run: python main.py)
    if args.command is None:
        args.command = "web"

    # ── Dispatch to the appropriate module ────────────────────────────

    if args.command == "web":
        # Import here (not at top) so other commands don't require Flask
        from app.server import start_server
        port  = getattr(args, 'port',  5000)
        host  = getattr(args, 'host',  '0.0.0.0')
        debug = getattr(args, 'debug', False)
        start_server(host=host, port=port, debug=debug)

    elif args.command == "simulate":
        # Import the simulator and run the 3-way validation comparison
        from ml_model.simulate import Simulator
        sim = Simulator()
        results = sim.run_validation(num_hands=args.hands)
        # Results are printed inside run_validation(); nothing else needed here.

    elif args.command == "train":
        # Import the trainer and start the training pipeline
        from ml_model.train import Trainer
        trainer = Trainer()
        results = trainer.train(num_hands=args.hands, epochs=args.epochs,
                                resume=args.resume)
        # The best model is saved to models/best_model.pt automatically.

    else:
        parser.print_help()


# Standard Python idiom: this block only runs when you execute
# this file directly (python main.py ...). It does NOT run when
# this file is imported by another module.
if __name__ == "__main__":
    main()

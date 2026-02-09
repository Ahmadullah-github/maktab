# ==============================================================================
#
#  Logging Configuration for Timetable Solver
#
#  Configures structlog to output clear, LLM-readable logs to stderr,
#  keeping stdout clean for JSON output only.
#
#  Usage:
#    from config.logging import setup_logging, get_logger
#    setup_logging()  # Call once at startup
#    log = get_logger()
#
# ==============================================================================

import sys
import structlog
from typing import Any, Dict


def setup_logging(debug: bool = True) -> None:
    """
    Configure structlog for development-friendly logging.

    All logs go to stderr to keep stdout clean for JSON output.
    Format is human-readable with clear prefixes for easy debugging.

    Args:
        debug: If True, show DEBUG level logs. If False, show INFO and above.
    """

    # Custom processor to add emoji prefixes for easy visual scanning
    def add_log_prefix(
        logger: Any, method_name: str, event_dict: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Add emoji prefix based on log level for easy visual scanning."""
        prefixes = {
            "debug": "🔍 DEBUG",
            "info": "ℹ️  INFO",
            "warning": "⚠️  WARN",
            "error": "❌ ERROR",
            "critical": "🔥 CRITICAL",
        }
        level = event_dict.get("level", method_name)
        event_dict["_prefix"] = prefixes.get(level, f"   {level.upper()}")
        return event_dict

    # Custom renderer for clear, readable output
    def dev_renderer(logger: Any, method_name: str, event_dict: Dict[str, Any]) -> str:
        """
        Render logs in a clear, LLM-readable format.

        Format: [PREFIX] message | key1=value1 | key2=value2
        """
        prefix = event_dict.pop("_prefix", "   LOG")
        event = event_dict.pop("event", "")
        timestamp = event_dict.pop("timestamp", "")

        # Remove internal structlog keys
        event_dict.pop("level", None)
        event_dict.pop("logger", None)

        # Build the log line
        parts = [f"[{prefix}]"]
        if timestamp:
            parts.append(f"[{timestamp}]")
        parts.append(event)

        # Add context as key=value pairs
        if event_dict:
            context_parts = []
            for key, value in event_dict.items():
                if isinstance(value, str) and len(value) > 100:
                    value = value[:100] + "..."
                context_parts.append(f"{key}={value}")
            if context_parts:
                parts.append("|")
                parts.append(" | ".join(context_parts))

        return " ".join(parts)

    # Configure structlog
    structlog.configure(
        processors=[
            # Add timestamp
            structlog.processors.TimeStamper(fmt="%H:%M:%S"),
            # Add log level
            structlog.stdlib.add_log_level,
            # Add our custom prefix
            add_log_prefix,
            # Render to string
            dev_renderer,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = None) -> structlog.stdlib.BoundLogger:
    """
    Get a configured logger instance.

    Args:
        name: Optional logger name for context

    Returns:
        Configured structlog logger
    """
    if name:
        return structlog.get_logger(name)
    return structlog.get_logger()


# Convenience function for quick debug logging
def debug_log(message: str, **kwargs) -> None:
    """Quick debug log with context."""
    log = get_logger()
    log.debug(message, **kwargs)


def info_log(message: str, **kwargs) -> None:
    """Quick info log with context."""
    log = get_logger()
    log.info(message, **kwargs)


def error_log(message: str, **kwargs) -> None:
    """Quick error log with context."""
    log = get_logger()
    log.error(message, **kwargs)

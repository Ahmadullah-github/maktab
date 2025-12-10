# ==============================================================================
#
#  Configuration Loader for Timetable Solver
#
#  Description:
#  Loads configuration from YAML files with environment variable overrides.
#  Supports multiple search paths and sensible defaults.
#
#  Requirements: 3.1, 3.5
#
# ==============================================================================

import os
from pathlib import Path
from typing import Optional, Union

import yaml

from .schema import SolverConfig


class ConfigLoader:
    """
    Loads solver configuration from YAML files and environment variables.
    
    Search paths (in order of priority):
    1. Explicit path provided to load()
    2. ./solver_config.yaml
    3. ./config/solver_config.yaml
    4. ~/.maktab/solver_config.yaml
    
    Environment variable overrides:
    - SOLVER_MAX_MEMORY_MB: Override memory.max_memory_mb
    - SOLVER_MAX_TIME_SECONDS: Override max_time_seconds
    
    Requirements: 3.1, 3.5
    """
    
    SEARCH_PATHS = [
        Path("./solver_config.yaml"),
        Path("./config/solver_config.yaml"),
        Path.home() / ".maktab" / "solver_config.yaml",
    ]
    
    # Environment variable mappings
    ENV_OVERRIDES = {
        "SOLVER_MAX_MEMORY_MB": ("memory", "max_memory_mb", int),
        "SOLVER_MAX_TIME_SECONDS": ("max_time_seconds", None, int),
    }
    
    @classmethod
    def load(cls, config_path: Optional[Union[str, Path]] = None) -> SolverConfig:
        """
        Load configuration from file or use defaults.
        
        Args:
            config_path: Optional explicit path to config file.
                        If None, searches default paths.
        
        Returns:
            SolverConfig with loaded or default values
            
        Note:
            If no config file is found, returns default configuration.
            Environment variables are always applied as overrides.
        """
        config_data = {}
        
        # Try to load from file
        if config_path:
            config_data = cls._load_yaml(Path(config_path))
        else:
            # Search default paths
            for path in cls.SEARCH_PATHS:
                if path.exists():
                    config_data = cls._load_yaml(path)
                    break
        
        # Create config from loaded data (or defaults if empty)
        config = SolverConfig.model_validate(config_data)
        
        # Apply environment variable overrides
        config = cls.apply_env_overrides(config)
        
        return config
    
    @classmethod
    def _load_yaml(cls, path: Path) -> dict:
        """
        Load YAML file and return as dictionary.
        
        Args:
            path: Path to YAML file
            
        Returns:
            Dictionary with configuration data
            
        Raises:
            FileNotFoundError: If file doesn't exist
            yaml.YAMLError: If file is not valid YAML
        """
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            return data if data else {}

    
    @classmethod
    def apply_env_overrides(cls, config: SolverConfig) -> SolverConfig:
        """
        Apply environment variable overrides to configuration.
        
        Supported environment variables:
        - SOLVER_MAX_MEMORY_MB: Override memory.max_memory_mb
        - SOLVER_MAX_TIME_SECONDS: Override max_time_seconds
        
        Args:
            config: Configuration to modify
            
        Returns:
            Modified configuration with environment overrides applied
        """
        # Convert to dict for modification
        config_dict = config.model_dump()
        
        for env_var, (section, field, converter) in cls.ENV_OVERRIDES.items():
            value = os.environ.get(env_var)
            if value is not None:
                try:
                    converted_value = converter(value)
                    
                    if field is None:
                        # Top-level field
                        config_dict[section] = converted_value
                    else:
                        # Nested field
                        if section not in config_dict:
                            config_dict[section] = {}
                        config_dict[section][field] = converted_value
                        
                except (ValueError, TypeError):
                    # Invalid value, skip override
                    pass
        
        return SolverConfig.model_validate(config_dict)
    
    @classmethod
    def save(cls, config: SolverConfig, path: Union[str, Path]) -> None:
        """
        Save configuration to YAML file.
        
        Args:
            config: Configuration to save
            path: Path to save to
            
        Note:
            Creates parent directories if they don't exist.
        """
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # Convert to dict, excluding None values for cleaner output
        config_dict = config.model_dump(exclude_none=True)
        
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(
                config_dict,
                f,
                default_flow_style=False,
                allow_unicode=True,
                sort_keys=False,
            )
    
    @classmethod
    def get_default_config(cls) -> SolverConfig:
        """
        Get default configuration without loading from file.
        
        Returns:
            SolverConfig with all default values
        """
        return SolverConfig()
    
    @classmethod
    def find_config_file(cls) -> Optional[Path]:
        """
        Find the first existing config file in search paths.
        
        Returns:
            Path to config file if found, None otherwise
        """
        for path in cls.SEARCH_PATHS:
            if path.exists():
                return path
        return None

import argparse
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Config:
    """
    Configuration for the Evidence.dev MCP server.
    """

    project_path: Path
    """
    Path to the Evidence.dev project root directory.
    """

    readonly: bool = True
    """
    Run server in read-only mode. Always True for Evidence.dev MCP server.
    """

    @property
    def data_path(self) -> Path:
        """
        Get the path to the Evidence.dev data directory.
        
        Returns:
            Path to the Evidence.dev data directory (.evidence/template/static/data).
        
        Raises:
            ValueError: If the data directory doesn't exist.
        """
        data_dir = self.project_path / ".evidence" / "template" / "static" / "data"
        if not data_dir.exists():
            raise ValueError(
                f"Evidence.dev data directory not found: {data_dir}. "
                f"Please run 'pnpm run sources' in your Evidence.dev project first."
            )
        return data_dir

    @staticmethod
    def from_arguments() -> "Config":
        """
        Parse command line arguments.
        """
        parser = argparse.ArgumentParser(description="Evidence.dev MCP Server")

        parser.add_argument(
            "--project-path",
            type=Path,
            help="Path to Evidence.dev project root directory",
            required=True,
        )

        # Readonly is always true for Evidence.dev MCP server
        args = parser.parse_args()
        return Config(project_path=args.project_path)

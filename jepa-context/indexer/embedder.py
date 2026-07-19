"""
Code embeddings using CodeBERT via sentence-transformers.
"""

from sentence_transformers import SentenceTransformer
from typing import List
import numpy as np


class CodeEmbedder:
    """Generate embeddings for code chunks."""

    def __init__(self, model_name: str = "microsoft/codebert-base"):
        """
        Initialize the embedder.

        Args:
            model_name: HuggingFace model name. Options:
                - microsoft/codebert-base (default, good for code)
                - sentence-transformers/all-MiniLM-L6-v2 (faster, general)
                - BAAI/bge-small-en-v1.5 (good balance)
        """
        self.model = SentenceTransformer(model_name)
        self.model_name = model_name

    def embed(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """
        Generate embeddings for a list of texts.

        Args:
            texts: List of code strings to embed
            batch_size: Batch size for encoding

        Returns:
            numpy array of embeddings, shape (len(texts), embedding_dim)
        """
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=True,
            convert_to_numpy=True,
        )
        return embeddings

    def embed_single(self, text: str) -> np.ndarray:
        """Embed a single text."""
        return self.model.encode(text, convert_to_numpy=True)

    @property
    def embedding_dim(self) -> int:
        """Get the embedding dimension."""
        return self.model.get_sentence_embedding_dimension()

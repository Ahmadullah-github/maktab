"""
Builds class clusters based on shared teacher relationships.

Uses graph-based algorithms to find natural groupings of classes.
"""
import structlog
from typing import List, Dict, Set, Any
from collections import defaultdict, deque
import copy

log = structlog.get_logger()


class ClassClusterBuilder:
    """
    Builds clusters of classes that can be solved independently.
    
    Uses teacher-class relationships to find connected components,
    then balances cluster sizes for optimal performance.
    """
    
    MAX_CLUSTER_SIZE = 150  # Maximum requests per cluster
    MIN_CLUSTER_SIZE = 30   # Minimum requests per cluster
    
    def __init__(self, data):
        """
        Initialize cluster builder.
        
        Args:
            data: TimetableData object
        """
        self.data = data
        self.teacher_map = {t.id: t for t in data.teachers}
        self.subject_map = {s.id: s for s in data.subjects}
        self.class_map = {c.id: c for c in data.classes}
    
    def build_clusters(self) -> List[Dict[str, Any]]:
        """
        Build class clusters using graph-based approach.
        
        Returns:
            List of cluster dictionaries with metadata
        """
        # Build teacher-class graph
        graph = self._build_teacher_class_graph()
        
        log.info("Built teacher-class graph",
                 num_classes=len(graph),
                 total_edges=sum(len(neighbors) for neighbors in graph.values()))
        
        # Find connected components (initial clusters)
        components = self._find_connected_components(graph)
        
        log.info(f"Found {len(components)} connected components")
        
        # Balance cluster sizes
        balanced_clusters = self._balance_clusters(components)
        
        log.info(f"Balanced to {len(balanced_clusters)} clusters")
        
        # Add metadata to clusters
        clusters_with_metadata = []
        for i, cluster_classes in enumerate(balanced_clusters):
            cluster_info = self._create_cluster_metadata(cluster_classes, i)
            clusters_with_metadata.append(cluster_info)
        
        return clusters_with_metadata
    
    def _build_teacher_class_graph(self) -> Dict[str, Set[str]]:
        """
        Build graph of class relationships based on shared teachers.
        
        Returns:
            Adjacency list: class_id -> set of connected class_ids
        """
        graph = defaultdict(set)
        
        # Initialize all classes as nodes
        for cls in self.data.classes:
            graph[cls.id] = set()
        
        # For each teacher, connect all classes they teach
        for teacher in self.data.teachers:
            # Find classes this teacher teaches
            teacher_classes = []
            
            for cls in self.data.classes:
                # Check if this class needs any subject this teacher can teach
                for subject_id in cls.subjectRequirements.keys():
                    if subject_id in teacher.primarySubjectIds:
                        teacher_classes.append(cls.id)
                        break  # Don't add same class multiple times
            
            # Connect all pairs of classes this teacher teaches
            for i, class_a in enumerate(teacher_classes):
                for class_b in teacher_classes[i+1:]:
                    graph[class_a].add(class_b)
                    graph[class_b].add(class_a)
        
        return graph
    
    def _find_connected_components(self, graph: Dict[str, Set[str]]) -> List[Set[str]]:
        """
        Find connected components using BFS.
        
        Args:
            graph: Adjacency list representation
        
        Returns:
            List of sets, each set is a component
        """
        visited = set()
        components = []
        
        for class_id in graph.keys():
            if class_id in visited:
                continue
            
            # BFS to find all nodes in this component
            component = set()
            queue = deque([class_id])
            
            while queue:
                current = queue.popleft()
                
                if current in visited:
                    continue
                
                visited.add(current)
                component.add(current)
                
                # Add neighbors to queue
                for neighbor in graph[current]:
                    if neighbor not in visited:
                        queue.append(neighbor)
            
            components.append(component)
        
        return components
    
    def _count_cluster_requests(self, class_ids: Set[str]) -> int:
        """Count total requests in a cluster."""
        total = 0
        for class_id in class_ids:
            cls = self.class_map[class_id]
            for req in cls.subjectRequirements.values():
                total += req.periodsPerWeek
        return total
    
    def _balance_clusters(self, components: List[Set[str]]) -> List[Set[str]]:
        """
        Balance cluster sizes to optimize performance.
        
        Strategy:
        1. Split very large clusters
        2. Merge very small clusters with neighbors
        3. Aim for balanced sizes
        
        Args:
            components: Initial connected components
        
        Returns:
            Balanced list of clusters
        """
        balanced = []
        
        for component in components:
            num_requests = self._count_cluster_requests(component)
            
            # If cluster is too large, try to split it
            if num_requests > self.MAX_CLUSTER_SIZE:
                log.info(f"Splitting large cluster with {num_requests} requests")
                split_clusters = self._split_cluster(component)
                balanced.extend(split_clusters)
            else:
                balanced.append(component)
        
        # Merge very small clusters (if any)
        balanced = self._merge_small_clusters(balanced)
        
        return balanced
    
    def _split_cluster(self, cluster: Set[str]) -> List[Set[str]]:
        """
        Split a large cluster into smaller sub-clusters.
        
        Uses simple partitioning for now - can be improved with
        more sophisticated graph partitioning algorithms.
        
        Args:
            cluster: Set of class IDs to split
        
        Returns:
            List of smaller clusters
        """
        # Simple strategy: split roughly in half
        # More sophisticated: use min-cut or spectral clustering
        
        classes = list(cluster)
        mid = len(classes) // 2
        
        cluster1 = set(classes[:mid])
        cluster2 = set(classes[mid:])
        
        # Check if either sub-cluster is still too large
        result = []
        for sub_cluster in [cluster1, cluster2]:
            num_requests = self._count_cluster_requests(sub_cluster)
            if num_requests > self.MAX_CLUSTER_SIZE:
                # Recursively split
                result.extend(self._split_cluster(sub_cluster))
            else:
                result.append(sub_cluster)
        
        return result
    
    def _merge_small_clusters(self, clusters: List[Set[str]]) -> List[Set[str]]:
        """
        Merge very small clusters to avoid overhead.
        
        Args:
            clusters: List of clusters
        
        Returns:
            List with small clusters merged
        """
        # Sort by size (request count)
        cluster_sizes = [(c, self._count_cluster_requests(c)) for c in clusters]
        cluster_sizes.sort(key=lambda x: x[1])
        
        merged = []
        current_merge = None
        current_size = 0
        
        for cluster, size in cluster_sizes:
            if size >= self.MIN_CLUSTER_SIZE:
                # Large enough - keep as is
                if current_merge:
                    merged.append(current_merge)
                    current_merge = None
                    current_size = 0
                merged.append(cluster)
            else:
                # Too small - merge with others
                if current_merge is None:
                    current_merge = cluster.copy()
                    current_size = size
                else:
                    current_merge.update(cluster)
                    current_size += size
                    
                    # If merged cluster is large enough, finalize it
                    if current_size >= self.MIN_CLUSTER_SIZE:
                        merged.append(current_merge)
                        current_merge = None
                        current_size = 0
        
        # Add any remaining merged cluster
        if current_merge:
            merged.append(current_merge)
        
        return merged
    
    def _create_cluster_metadata(self, class_ids: Set[str], cluster_id: int) -> Dict[str, Any]:
        """
        Create metadata for a cluster.
        
        Args:
            class_ids: Set of class IDs in cluster
            cluster_id: Numeric cluster identifier
        
        Returns:
            Dictionary with cluster information
        """
        # Find teachers needed for this cluster
        teachers_needed = set()
        num_requests = 0
        
        for class_id in class_ids:
            cls = self.class_map[class_id]
            
            for subject_id, req in cls.subjectRequirements.items():
                num_requests += req.periodsPerWeek
                
                # Find teachers who can teach this subject
                for teacher in self.data.teachers:
                    if subject_id in teacher.primarySubjectIds:
                        teachers_needed.add(teacher.id)
        
        return {
            'cluster_id': cluster_id,
            'classes': list(class_ids),
            'num_classes': len(class_ids),
            'num_requests': num_requests,
            'teachers': list(teachers_needed),
            'num_teachers': len(teachers_needed)
        }
    
    def create_sub_problem_data(self, cluster: Dict[str, Any]):
        """
        Create a subset of TimetableData for a cluster.
        
        Args:
            cluster: Cluster metadata dictionary
        
        Returns:
            New TimetableData object with only cluster's data
        """
        # Deep copy the original data structure
        sub_data = copy.deepcopy(self.data)
        
        # Filter classes
        cluster_class_ids = set(cluster['classes'])
        sub_data.classes = [c for c in sub_data.classes if c.id in cluster_class_ids]
        
        # Filter teachers (only those needed for this cluster)
        cluster_teacher_ids = set(cluster['teachers'])
        sub_data.teachers = [t for t in sub_data.teachers if t.id in cluster_teacher_ids]
        
        # Filter fixed lessons
        if sub_data.fixedLessons:
            sub_data.fixedLessons = [
                lesson for lesson in sub_data.fixedLessons
                if lesson.classId in cluster_class_ids
            ]
        
        # Rooms are shared - keep all rooms
        # Subjects are shared - keep all subjects
        # Config stays the same
        
        log.info(f"Created sub-problem for cluster {cluster['cluster_id']}",
                 num_classes=len(sub_data.classes),
                 num_teachers=len(sub_data.teachers),
                 num_requests=cluster['num_requests'])
        
        return sub_data

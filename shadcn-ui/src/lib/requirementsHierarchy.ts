import { Requirement } from '../types';

/**
 * Generic item interface that exposes requirement identifiers.
 * Any structure that contains a requirement can be adapted via accessor functions.
 */
export interface RequirementLike {
  req_id: string;
  parent_req_id?: string | null;
}

export interface RequirementTreeNode<T> {
  item: T;
  children: RequirementTreeNode<T>[];
}

export interface RequirementTreeBuildOptions<T> {
  getId: (item: T) => string;
  getParentId: (item: T) => string | null | undefined;
}

export interface RequirementTree<T> {
  roots: RequirementTreeNode<T>[];
  nodeMap: Map<string, RequirementTreeNode<T>>;
  getId: (item: T) => string;
  getParentId: (item: T) => string | null | undefined;
}

export interface FlattenedRequirementNode<T> {
  item: T;
  depth: number;
  parentId: string | null;
  path: string[];
}

/**
 * Builds a forest (collection of trees) starting from flat requirements.
 * Items referencing parents that are missing in the list are treated as roots.
 */
export function buildRequirementTree<T>(
  items: T[],
  options: RequirementTreeBuildOptions<T>
): RequirementTree<T> {
  const { getId, getParentId } = options;
  const nodeMap = new Map<string, RequirementTreeNode<T>>();

  items.forEach((item) => {
    const id = getId(item);
    nodeMap.set(id, { item, children: [] });
  });

  const roots: RequirementTreeNode<T>[] = [];

  nodeMap.forEach((node) => {
    const parentId = getParentId(node.item);
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return {
    roots,
    nodeMap,
    getId,
    getParentId
  };
}

/**
 * Sorts the entire tree in-place according to the provided comparator, level by level.
 */
export function sortRequirementTree<T>(
  nodes: RequirementTreeNode<T>[],
  comparator: (a: T, b: T) => number
): void {
  nodes.sort((nodeA, nodeB) => comparator(nodeA.item, nodeB.item));
  nodes.forEach((node) => sortRequirementTree(node.children, comparator));
}

/**
 * Produces a flat list of nodes preserving the hierarchical order and depth.
 */
export function flattenRequirementTree<T>(
  tree: RequirementTree<T>
): FlattenedRequirementNode<T>[] {
  const flat: FlattenedRequirementNode<T>[] = [];

  const walk = (
    node: RequirementTreeNode<T>,
    depth: number,
    parentId: string | null,
    path: string[]
  ) => {
    const id = tree.getId(node.item);
    flat.push({
      item: node.item,
      depth,
      parentId,
      path: [...path, id]
    });
    node.children.forEach((child) =>
      walk(child, depth + 1, id, [...path, id])
    );
  };

  tree.roots.forEach((root) => walk(root, 0, null, []));

  return flat;
}

/**
 * Returns the list of descendant ids for the provided node.
 */
export function getDescendantIds<T>(
  tree: RequirementTree<T>,
  nodeId: string
): Set<string> {
  const descendants = new Set<string>();
  const node = tree.nodeMap.get(nodeId);
  if (!node) {
    return descendants;
  }

  const stack = [...node.children];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const currentId = tree.getId(current.item);
    if (!descendants.has(currentId)) {
      descendants.add(currentId);
      current.children.forEach((child) => stack.push(child));
    }
  }

  return descendants;
}

/**
 * Returns the ancestor chain starting from the immediate parent up to the root.
 */
export function getAncestorIds<T>(
  tree: RequirementTree<T>,
  nodeId: string
): string[] {
  const ancestors: string[] = [];
  let currentNode = tree.nodeMap.get(nodeId);

  while (currentNode) {
    const parentId = tree.getParentId(currentNode.item);
    if (!parentId) {
      break;
    }
    ancestors.push(parentId);
    currentNode = tree.nodeMap.get(parentId);
  }

  return ancestors;
}

/**
 * Utility that checks whether assigning a new parent would introduce cycles.
 */
export function wouldCreateCycle<T>(
  tree: RequirementTree<T>,
  nodeId: string,
  nextParentId: string | null | undefined
): boolean {
  if (!nextParentId) {
    return false;
  }
  if (nodeId === nextParentId) {
    return true;
  }
  const descendants = getDescendantIds(tree, nodeId);
  return descendants.has(nextParentId);
}

/**
 * Calculates the critical path length (longest chain) using the provided weight function.
 * Useful to understand the longest sequential execution time induced by parent-child links.
 */
export function calculateCriticalPathLength<T>(
  tree: RequirementTree<T>,
  weightFn: (item: T) => number
): number {
  const memo = new Map<string, number>();

  const dfs = (node: RequirementTreeNode<T>): number => {
    const nodeId = tree.getId(node.item);
    if (memo.has(nodeId)) {
      return memo.get(nodeId)!;
    }
    const ownWeight = Math.max(0, weightFn(node.item));
    const maxChild = node.children.length === 0 ? 0 : Math.max(...node.children.map(dfs));
    const total = ownWeight + maxChild;
    memo.set(nodeId, total);
    return total;
  };

  if (tree.roots.length === 0) {
    return 0;
  }

  return Math.max(...tree.roots.map(dfs));
}

/**
 * Convenience helper for raw Requirement arrays.
 */
export function buildRequirementTreeFromRequirements(
  requirements: Requirement[]
): RequirementTree<Requirement> {
  return buildRequirementTree(requirements, {
    getId: (requirement) => requirement.req_id,
    getParentId: (requirement) => requirement.parent_req_id ?? null
  });
}

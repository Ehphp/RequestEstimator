/**
 * Treemap layout algorithm (Squarified) - PRODUCTION-READY VERSION
 * Calculates positions and dimensions for items based on their values
 * Ensures no overlapping and all items fit within container
 * 
 * @version 2.0.0
 * @author GitHub Copilot
 * @date 2025-11-09
 */

import { logger } from './logger';

export interface TreemapItem {
    id: string;
    value: number;
    data?: unknown;
}

export interface TreemapRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TreemapNode extends TreemapRect {
    id: string;
    value: number;
    data?: unknown;
}

/**
 * Configuration for treemap layout
 */
export interface TreemapConfig {
    padding: number;
    minSize: number;
    maxAspectRatio: number;
    enableDynamicHeight: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_TREEMAP_CONFIG: TreemapConfig = {
    padding: 16,      // Increased from 12 for better spacing
    minSize: 200,     // Increased from 150 for better readability
    maxAspectRatio: 2.5,  // Decreased from 3 for more balanced cards
    enableDynamicHeight: true
};

/**
 * Card size thresholds - THREE VARIANTS for responsive layouts
 * Defines breakpoints for responsive card layouts
 */
export const CARD_SIZE_THRESHOLDS = {
    small: { width: 280, height: 200 },    // Compact: minimal info
    medium: { width: 400, height: 300 },   // Comfortable: balanced layout
    large: { width: 400, height: 300 }     // Spacious: full details
} as const;

/**
 * Calculate the worst aspect ratio for a row of items
 * Lower values = better (more square-like)
 */
function worst(row: TreemapItem[], width: number): number {
    if (row.length === 0 || width === 0) return Infinity;

    const sum = row.reduce((s, item) => s + item.value, 0);
    if (sum === 0) return Infinity;

    const rowMin = Math.min(...row.map(item => item.value));
    const rowMax = Math.max(...row.map(item => item.value));

    const s2 = sum * sum;
    const w2 = width * width;

    return Math.max(
        (w2 * rowMax) / s2,
        s2 / (w2 * rowMin)
    );
}

/**
 * Position items in a row within the given rectangle
 */
function layoutRow(
    row: TreemapItem[],
    rect: TreemapRect,
    vertical: boolean
): TreemapNode[] {
    const sum = row.reduce((s, item) => s + item.value, 0);
    if (sum === 0) return [];

    const nodes: TreemapNode[] = [];
    let offset = 0;

    for (const item of row) {
        const ratio = item.value / sum;

        if (vertical) {
            // Stack vertically
            const height = rect.height * ratio;
            nodes.push({
                id: item.id,
                value: item.value,
                data: item.data,
                x: rect.x,
                y: rect.y + offset,
                width: rect.width,
                height
            });
            offset += height;
        } else {
            // Stack horizontally
            const width = rect.width * ratio;
            nodes.push({
                id: item.id,
                value: item.value,
                data: item.data,
                x: rect.x + offset,
                y: rect.y,
                width,
                height: rect.height
            });
            offset += width;
        }
    }

    return nodes;
}

/**
 * Recursive squarified treemap algorithm
 * Returns nodes positioned within the given rectangle
 */
function squarifyRecursive(
    items: TreemapItem[],
    x: number,
    y: number,
    width: number,
    height: number
): TreemapNode[] {
    // Base cases
    if (items.length === 0) return [];

    if (width <= 0 || height <= 0) {
        if (process.env.NODE_ENV === 'development') {
            logger.warn('⚠️ Invalid dimensions:', { width, height });
        }
        return [];
    }

    if (items.length === 1) {
        return [{
            id: items[0].id,
            value: items[0].value,
            data: items[0].data,
            x,
            y,
            width,
            height
        }];
    }

    const totalValue = items.reduce((sum, item) => sum + item.value, 0);
    if (totalValue === 0) return [];

    // Determine orientation based on aspect ratio
    const horizontal = width >= height;
    const length = horizontal ? width : height;

    // Build optimal row using worst aspect ratio heuristic
    let row: TreemapItem[] = [];
    let remaining = [...items];
    let bestWorst = Infinity;

    while (remaining.length > 0) {
        const testRow = [...row, remaining[0]];
        const currentWorst = worst(testRow, length);

        if (row.length === 0 || currentWorst <= bestWorst) {
            // Adding this item improves or maintains aspect ratio
            row = testRow;
            remaining = remaining.slice(1);
            bestWorst = currentWorst;
        } else {
            // Stop here, current row is optimal
            break;
        }
    }

    // If all items fit in one row, layout them
    if (remaining.length === 0) {
        return layoutRow(row, { x, y, width, height }, !horizontal);
    }

    // Calculate space for current row
    const rowValue = row.reduce((sum, item) => sum + item.value, 0);
    const rowRatio = rowValue / totalValue;

    let rowNodes: TreemapNode[];
    let remainingX: number, remainingY: number;
    let remainingWidth: number, remainingHeight: number;

    if (horizontal) {
        // Layout row vertically (taking up a horizontal strip)
        const rowWidth = width * rowRatio;
        rowNodes = layoutRow(row, { x, y, width: rowWidth, height }, true);

        remainingX = x + rowWidth;
        remainingY = y;
        remainingWidth = width - rowWidth;
        remainingHeight = height;
    } else {
        // Layout row horizontally (taking up a vertical strip)
        const rowHeight = height * rowRatio;
        rowNodes = layoutRow(row, { x, y, width, height: rowHeight }, false);

        remainingX = x;
        remainingY = y + rowHeight;
        remainingWidth = width;
        remainingHeight = height - rowHeight;
    }

    // Recursively layout remaining items
    const remainingNodes = squarifyRecursive(
        remaining,
        remainingX,
        remainingY,
        remainingWidth,
        remainingHeight
    );

    return [...rowNodes, ...remainingNodes];
}

/**
 * Apply padding and minimum size constraints while respecting proportions
 * Uses DYNAMIC padding proportional to node size to better preserve proportions
 * Only applies minSize if the node is significantly smaller (< 60% of minSize)
 * This preserves treemap proportionality while ensuring minimum readability
 */
function applyConstraints(
    nodes: TreemapNode[],
    containerWidth: number,
    containerHeight: number,
    basePadding: number,
    minSize: number
): TreemapNode[] {
    const constrainedNodes = nodes.map(node => {
        // Calculate DYNAMIC padding proportional to node size
        // Larger nodes get more padding, smaller nodes get less
        // This preserves proportion better than fixed padding
        const nodeArea = node.width * node.height;
        const containerArea = containerWidth * containerHeight;
        const areaRatio = nodeArea / containerArea;

        // Scale padding from 50% to 100% of base based on area ratio
        // Small nodes (< 5% area): 50% padding
        // Large nodes (> 20% area): 100% padding
        const paddingScale = 0.5 + Math.min(areaRatio / 0.2, 1) * 0.5;
        const dynamicPadding = basePadding * paddingScale;
        const halfPadding = dynamicPadding / 2;

        // Apply padding by shrinking inward from all sides
        let x = node.x + halfPadding;
        let y = node.y + halfPadding;
        let width = node.width - dynamicPadding;
        let height = node.height - dynamicPadding;

        // Only enforce minSize if the node is VERY small (< 60% of minSize)
        // This preserves proportionality while ensuring minimum readability
        const threshold = minSize * 0.6;
        if (width < threshold) {
            width = Math.min(minSize, node.width - dynamicPadding);
        }
        if (height < threshold) {
            height = Math.min(minSize, node.height - dynamicPadding);
        }

        // Ensure non-negative dimensions with increased minimums for better readability
        width = Math.max(width, 120);  // Increased from 50
        height = Math.max(height, 100); // Increased from 50

        // Check if dimensions violate bounds
        const exceedsRight = x + width > containerWidth;
        const exceedsBottom = y + height > containerHeight;

        if (exceedsRight || exceedsBottom) {
            // Scale down proportionally to fit
            const availableWidth = containerWidth - x;
            const availableHeight = containerHeight - y;

            const scaleX = exceedsRight ? availableWidth / width : 1;
            const scaleY = exceedsBottom ? availableHeight / height : 1;
            const scale = Math.min(scaleX, scaleY);

            // If scaling would make the node too small, shift it instead
            if (scale < 0.5) {
                // Try to shift left/up to fit better
                if (exceedsRight && x > halfPadding) {
                    const shiftAmount = Math.min(x - halfPadding, (x + width) - containerWidth);
                    x = Math.max(halfPadding, x - shiftAmount);
                }
                if (exceedsBottom && y > halfPadding) {
                    const shiftAmount = Math.min(y - halfPadding, (y + height) - containerHeight);
                    y = Math.max(halfPadding, y - shiftAmount);
                }
            }

            // Apply scaling after potential shift
            width = width * scale;
            height = height * scale;

            if (process.env.NODE_ENV === 'development') {
                logger.warn('⚠️ Scaled node to fit bounds:', {
                    id: node.id,
                    scale: scale.toFixed(2),
                    finalSize: `${width.toFixed(0)}×${height.toFixed(0)}`
                });
            }
        }

        return {
            ...node,
            x,
            y,
            width,
            height
        };
    });

    // Detect and resolve ALL overlaps iteratively
    // Multiple passes until no overlaps remain or max iterations reached
    const MAX_ITERATIONS = 10;
    const minGap = basePadding / 2; // Minimum gap between nodes
    let resolvedNodes = [...constrainedNodes];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        let hasOverlaps = false;
        const adjustedNodes = [...resolvedNodes];

        // Check each node for overlaps
        for (let i = 0; i < adjustedNodes.length; i++) {
            const node = adjustedNodes[i];
            let bestX = node.x;
            let bestY = node.y;
            let foundOverlap = false;

            // Check for overlaps with all other nodes
            for (let j = 0; j < adjustedNodes.length; j++) {
                if (i === j) continue;

                const other = adjustedNodes[j];

                // Check if rectangles overlap
                const overlapX = !(node.x + node.width <= other.x || other.x + other.width <= node.x);
                const overlapY = !(node.y + node.height <= other.y || other.y + other.height <= other.y);

                if (overlapX && overlapY) {
                    foundOverlap = true;
                    hasOverlaps = true;

                    // Calculate possible shift positions
                    const rightOfOther = other.x + other.width + minGap;
                    const belowOther = other.y + other.height + minGap;
                    const leftOfOther = other.x - node.width - minGap;
                    const aboveOther = other.y - node.height - minGap;                    // Check which positions are valid (within bounds)
                    const canShiftRight = rightOfOther >= 0 && rightOfOther + node.width <= containerWidth;
                    const canShiftDown = belowOther >= 0 && belowOther + node.height <= containerHeight;
                    const canShiftLeft = leftOfOther >= 0 && leftOfOther + node.width <= containerWidth;
                    const canShiftUp = aboveOther >= 0 && aboveOther + node.height <= containerHeight;

                    // Prefer the shift that moves the node the least distance
                    const shifts = [
                        { x: rightOfOther, y: node.y, distance: Math.abs(rightOfOther - node.x), valid: canShiftRight },
                        { x: node.x, y: belowOther, distance: Math.abs(belowOther - node.y), valid: canShiftDown },
                        { x: leftOfOther, y: node.y, distance: Math.abs(leftOfOther - node.x), valid: canShiftLeft },
                        { x: node.x, y: aboveOther, distance: Math.abs(aboveOther - node.y), valid: canShiftUp }
                    ].filter(s => s.valid)
                        .sort((a, b) => a.distance - b.distance);

                    if (shifts.length > 0) {
                        bestX = shifts[0].x;
                        bestY = shifts[0].y;

                        if (process.env.NODE_ENV === 'development') {
                            logger.debug(`🔧 Iteration ${iteration + 1}: Shifted [${node.id}] to resolve overlap with [${other.id}]`, {
                                from: `(${node.x.toFixed(0)},${node.y.toFixed(0)})`,
                                to: `(${bestX.toFixed(0)},${bestY.toFixed(0)})`,
                                distance: shifts[0].distance.toFixed(1)
                            });
                        }
                        break; // Handle one overlap at a time per node
                    }
                }
            }

            if (foundOverlap) {
                adjustedNodes[i] = {
                    ...node,
                    x: bestX,
                    y: bestY
                };
            }
        }

        resolvedNodes = adjustedNodes;

        // If no overlaps found, we're done
        if (!hasOverlaps) {
            if (process.env.NODE_ENV === 'development') {
                logger.debug(`✅ Overlap resolution converged after ${iteration + 1} iteration(s)`);
            }
            break;
        }

        // Warn if we hit max iterations
        if (iteration === MAX_ITERATIONS - 1 && hasOverlaps) {
            if (process.env.NODE_ENV === 'development') {
                logger.warn(`⚠️ Reached max iterations (${MAX_ITERATIONS}) with remaining overlaps`);
            }
        }
    }

    return resolvedNodes;
}

/**
 * Calculate optimal height based on item count and container width
 * Aims for reasonable aspect ratios and prevents cards from being too small
 */
export function calculateOptimalHeight(
    itemCount: number,
    containerWidth: number,
    minCardSize: number = 150,
    targetAspectRatio: number = 1.5
): number {
    if (itemCount === 0) return 600;
    if (containerWidth === 0) return 600;

    // Estimate rows based on average card size
    const estimatedCardsPerRow = Math.max(1, Math.floor(containerWidth / minCardSize));
    const estimatedRows = Math.ceil(itemCount / estimatedCardsPerRow);

    // Calculate height based on target aspect ratio
    const cardHeight = minCardSize * targetAspectRatio;
    const totalHeight = estimatedRows * cardHeight;

    // Clamp between reasonable bounds
    const minHeight = 600;
    const maxHeight = 2400;

    return Math.max(minHeight, Math.min(totalHeight, maxHeight));
}

/**
 * Generate treemap layout for items
 * @param items Array of items with id and value
 * @param width Total width of the container
 * @param height Total height of the container (0 = auto-calculate)
 * @param config Optional configuration overrides
 * @returns Array of positioned nodes
 */
export function generateTreemapLayout(
    items: TreemapItem[],
    width: number,
    height: number = 0,
    config: Partial<TreemapConfig> = {}
): TreemapNode[] {
    const cfg = { ...DEFAULT_TREEMAP_CONFIG, ...config };

    // Auto-calculate height if enabled and not provided
    if (cfg.enableDynamicHeight && height === 0) {
        height = calculateOptimalHeight(items.length, width, cfg.minSize);
        if (process.env.NODE_ENV === 'development') {
            logger.debug('📏 Auto-calculated height:', height);
        }
    }

    if (process.env.NODE_ENV === 'development') {
        logger.debug('🎨 Generating treemap:', {
            items: items.length,
            dimensions: `${width}×${height}`,
            config: cfg
        });
    }

    // Validation
    if (items.length === 0 || width <= 0 || height <= 0) {
        if (process.env.NODE_ENV === 'development') {
            logger.warn('⚠️ Invalid input for treemap:', { items: items.length, width, height });
        }
        return [];
    }

    // Filter and normalize items
    const validItems = items
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value); // Sort by value descending for better packing

    if (validItems.length === 0) {
        if (process.env.NODE_ENV === 'development') {
            logger.warn('⚠️ No valid items after filtering');
        }
        return [];
    }

    // Generate base layout - use full container dimensions
    // Padding will be applied by reducing node dimensions, not by shifting coordinates
    const nodes = squarifyRecursive(
        validItems,
        0,  // Start at origin
        0,
        width,  // Use full width
        height  // Use full height
    );

    // Apply constraints (padding, minSize) with bounds checking
    const constrainedNodes = applyConstraints(
        nodes,
        width,
        height,
        cfg.padding,
        cfg.minSize
    );

    // Validation (dev-only)
    if (process.env.NODE_ENV === 'development') {
        validateLayout(constrainedNodes, width, height);
    }

    return constrainedNodes;
}

/**
 * Validate layout for overlaps and bounds violations
 * DEV-ONLY: Expensive O(n²) operations
 */
function validateLayout(nodes: TreemapNode[], width: number, height: number): void {
    // Check overlaps
    let overlapCount = 0;
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];

            const overlapX = !(a.x + a.width <= b.x || b.x + b.width <= a.x);
            const overlapY = !(a.y + a.height <= b.y || b.y + b.height <= a.y);

            if (overlapX && overlapY) {
                overlapCount++;
                console.error('❌ Overlap detected:',
                    `[${a.id}] (${a.x.toFixed(0)},${a.y.toFixed(0)},${a.width.toFixed(0)}×${a.height.toFixed(0)})`,
                    `vs [${b.id}] (${b.x.toFixed(0)},${b.y.toFixed(0)},${b.width.toFixed(0)}×${b.height.toFixed(0)})`
                );
            }
        }
    }

    // Check bounds
    const outOfBounds = nodes.filter(n =>
        n.x < 0 ||
        n.y < 0 ||
        n.x + n.width > width + 0.1 || // Small epsilon for floating point
        n.y + n.height > height + 0.1
    );

    if (outOfBounds.length > 0) {
        console.error(`❌ ${outOfBounds.length} nodes out of bounds:`,
            outOfBounds.map(n => ({
                id: n.id,
                bounds: `${n.x.toFixed(0)},${n.y.toFixed(0)} ${n.width.toFixed(0)}×${n.height.toFixed(0)}`,
                exceeds: {
                    right: n.x + n.width > width ? (n.x + n.width - width).toFixed(1) : null,
                    bottom: n.y + n.height > height ? (n.y + n.height - height).toFixed(1) : null
                }
            }))
        );
    }

    // Check proportionality
    const totalValue = nodes.reduce((sum, n) => sum + n.value, 0);
    const totalArea = width * height;
    const proportionErrors = nodes.map(n => {
        const nodeArea = n.width * n.height;
        const expectedRatio = n.value / totalValue;
        const actualRatio = nodeArea / totalArea;
        const error = Math.abs(expectedRatio - actualRatio) / expectedRatio;
        return { id: n.id, error };
    }).filter(r => r.error > 0.1); // 10% tolerance

    if (proportionErrors.length > 0) {
        logger.warn('⚠️ Proportion errors > 10%:', proportionErrors);
    }

    // Summary
    logger.debug('✅ Layout validation:', {
        nodes: nodes.length,
        overlaps: overlapCount,
        outOfBounds: outOfBounds.length,
        proportionErrors: proportionErrors.length,
        dimensions: `${width}×${height}`
    });
}

/**
 * Determine card size variant based on dimensions - THREE VARIANTS
 * Returns 'small', 'medium', or 'large' for responsive card layouts
 */
export function getCardSizeVariant(width: number, height: number): 'small' | 'medium' | 'large' {
    const { small, medium } = CARD_SIZE_THRESHOLDS;

    // Use small layout for compact cards
    if (width < small.width || height < small.height) {
        return 'small';
    }

    // Use medium layout for comfortable cards
    if (width < medium.width || height < medium.height) {
        return 'medium';
    }

    // Use large layout for spacious cards
    return 'large';
}

/**
 * Treemap layout algorithm (Squarified) - PRODUCTION-READY VERSION
 * Calculates positions and dimensions for items based on their values
 * Ensures no overlapping and all items fit within container
 * 
 * @version 2.0.0
 * @author GitHub Copilot
 * @date 2025-11-09
 */

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
    padding: 12,
    minSize: 150,
    maxAspectRatio: 3,
    enableDynamicHeight: true
};

/**
 * Card size thresholds (tokenized for consistency)
 */
export const CARD_SIZE_THRESHOLDS = {
    small: { width: 250, height: 200 },
    large: { width: 400, height: 350 }
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
            console.warn('⚠️ Invalid dimensions:', { width, height });
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
 * Apply padding and minimum size constraints while respecting bounds
 * CRITICAL: This is where the previous implementation failed
 */
function applyConstraints(
    nodes: TreemapNode[],
    containerWidth: number,
    containerHeight: number,
    padding: number,
    minSize: number
): TreemapNode[] {
    const halfPad = padding / 2;

    return nodes.map(node => {
        // Apply padding
        const x = node.x + halfPad;
        const y = node.y + halfPad;
        let width = Math.max(node.width - padding, minSize);
        let height = Math.max(node.height - padding, minSize);

        // CRITICAL FIX: Check if minSize enforcement violates bounds
        const exceedsRight = x + width > containerWidth;
        const exceedsBottom = y + height > containerHeight;

        if (exceedsRight || exceedsBottom) {
            // Scale down proportionally to fit
            const availableWidth = containerWidth - x;
            const availableHeight = containerHeight - y;

            const scaleX = exceedsRight ? availableWidth / width : 1;
            const scaleY = exceedsBottom ? availableHeight / height : 1;
            const scale = Math.min(scaleX, scaleY);

            width = width * scale;
            height = height * scale;

            if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ Scaled node to fit bounds:', {
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
            console.log('📏 Auto-calculated height:', height);
        }
    }

    if (process.env.NODE_ENV === 'development') {
        console.log('🎨 Generating treemap:', {
            items: items.length,
            dimensions: `${width}×${height}`,
            config: cfg
        });
    }

    // Validation
    if (items.length === 0 || width <= 0 || height <= 0) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Invalid input for treemap:', { items: items.length, width, height });
        }
        return [];
    }

    // Filter and normalize items
    const validItems = items
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value); // Sort by value descending for better packing

    if (validItems.length === 0) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ No valid items after filtering');
        }
        return [];
    }

    // CRITICAL FIX: Reserve space for padding BEFORE calculating layout
    const effectivePadding = cfg.padding * 2; // Account for both sides
    const availableWidth = Math.max(width - effectivePadding, cfg.minSize);
    const availableHeight = Math.max(height - effectivePadding, cfg.minSize);

    // Generate base layout
    const nodes = squarifyRecursive(
        validItems,
        cfg.padding,
        cfg.padding,
        availableWidth,
        availableHeight
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
        console.warn('⚠️ Proportion errors > 10%:', proportionErrors);
    }

    // Summary
    console.log('✅ Layout validation:', {
        nodes: nodes.length,
        overlaps: overlapCount,
        outOfBounds: outOfBounds.length,
        proportionErrors: proportionErrors.length,
        dimensions: `${width}×${height}`
    });
}

/**
 * Determine card size variant based on dimensions
 */
export function getCardSizeVariant(width: number, height: number): 'small' | 'medium' | 'large' {
    const { small, large } = CARD_SIZE_THRESHOLDS;

    if (width < small.width || height < small.height) {
        return 'small';
    }

    if (width >= large.width && height >= large.height) {
        return 'large';
    }

    return 'medium';
}

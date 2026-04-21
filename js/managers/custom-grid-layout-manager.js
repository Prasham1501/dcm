/**
 * Custom Grid Layout Manager
 * Handles dynamic grid layouts with Excel-style selector
 * Supports 1x1 up to 5x5 grids (max 25 viewports)
 * Mobile responsive with max 5 viewports on mobile
 */

window.DICOM_VIEWER.CustomGridLayoutManager = class {
    constructor() {
        this.maxGridSize = 5; // 5x5 = 25 viewports max
        this.mobileMaxViewports = 5;
        this.currentCustomGrid = null;
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;

        console.log('Initializing Custom Grid Layout Manager');
        this.createGridSelector();
        this.setupEventListeners();
        this.initialized = true;
    }

    /**
     * Create Excel-style grid selector UI
     */
    createGridSelector() {
        const layoutControlsContainer = document.querySelector('.mpr-controls .controls-group-left .control-group');

        if (!layoutControlsContainer) {
            console.error('Layout controls container not found');
            return;
        }

        // Create custom grid button
        const customGridBtn = document.createElement('button');
        customGridBtn.type = 'button';
        customGridBtn.className = 'btn btn-sm btn-secondary';
        customGridBtn.id = 'customGridBtn';
        customGridBtn.innerHTML = '<i class="bi bi-grid-3x3-gap"></i>';
        customGridBtn.title = 'Custom Grid Layout';

        // Add to existing button group
        const btnGroup = layoutControlsContainer.querySelector('.btn-group');
        if (btnGroup) {
            btnGroup.appendChild(customGridBtn);
        }

        // Create grid selector popup
        this.createGridSelectorPopup();
    }

    /**
     * Create the Excel-style grid selector popup
     */
    createGridSelectorPopup() {
        const popup = document.createElement('div');
        popup.id = 'gridSelectorPopup';
        popup.className = 'grid-selector-popup';
        popup.style.cssText = `
            position: fixed;
            display: none;
            background: #1c2128;
            border: 2px solid #0d6efd;
            border-radius: 8px;
            padding: 15px;
            z-index: 9999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

        // Create title
        const title = document.createElement('div');
        title.className = 'grid-selector-title';
        title.textContent = 'Select Grid Size';
        title.style.cssText = 'color: #fff; font-weight: bold; margin-bottom: 10px; text-align: center;';
        popup.appendChild(title);

        // Create grid container
        const gridContainer = document.createElement('div');
        gridContainer.id = 'gridSelectorGrid';
        gridContainer.className = 'grid-selector-grid';
        gridContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(${this.maxGridSize}, 30px);
            grid-template-rows: repeat(${this.maxGridSize}, 30px);
            gap: 2px;
            margin-bottom: 10px;
        `;

        // Create grid cells
        for (let row = 0; row < this.maxGridSize; row++) {
            for (let col = 0; col < this.maxGridSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.row = row + 1;
                cell.dataset.col = col + 1;
                cell.style.cssText = `
                    background: #2d3748;
                    border: 1px solid #4a5568;
                    cursor: pointer;
                    transition: all 0.2s;
                `;

                cell.addEventListener('mouseenter', (e) => this.highlightCells(e));
                cell.addEventListener('click', (e) => this.selectGrid(e));

                gridContainer.appendChild(cell);
            }
        }

        popup.appendChild(gridContainer);

        // Create selection label
        const label = document.createElement('div');
        label.id = 'gridSelectionLabel';
        label.className = 'grid-selection-label';
        label.textContent = 'Hover to preview';
        label.style.cssText = 'color: #0d6efd; text-align: center; font-size: 14px; font-weight: bold;';
        popup.appendChild(label);

        document.body.appendChild(popup);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const customGridBtn = document.getElementById('customGridBtn');
        if (customGridBtn) {
            customGridBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleGridSelector();
            });
        }

        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            const popup = document.getElementById('gridSelectorPopup');
            const customGridBtn = document.getElementById('customGridBtn');

            if (popup && !popup.contains(e.target) && e.target !== customGridBtn) {
                popup.style.display = 'none';
            }
        });
    }

    /**
     * Toggle grid selector popup visibility
     */
    toggleGridSelector() {
        const popup = document.getElementById('gridSelectorPopup');
        const button = document.getElementById('customGridBtn');

        if (!popup || !button) return;

        const isVisible = popup.style.display === 'block';

        if (isVisible) {
            popup.style.display = 'none';
        } else {
            // Position popup near button
            const rect = button.getBoundingClientRect();
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 10}px`;
            popup.style.display = 'block';
        }
    }

    /**
     * Highlight cells on hover
     */
    highlightCells(event) {
        const cell = event.target;
        const rows = parseInt(cell.dataset.row);
        const cols = parseInt(cell.dataset.col);

        // Check mobile viewport count limit
        const totalViewports = rows * cols;
        const isMobile = window.innerWidth < 768;

        if (isMobile && totalViewports > this.mobileMaxViewports) {
            this.updateSelectionLabel(`Mobile max: ${this.mobileMaxViewports} viewports`);
            return;
        }

        const allCells = document.querySelectorAll('.grid-cell');

        allCells.forEach(c => {
            const cellRow = parseInt(c.dataset.row);
            const cellCol = parseInt(c.dataset.col);

            if (cellRow <= rows && cellCol <= cols) {
                c.style.background = '#0d6efd';
                c.style.borderColor = '#0d6efd';
            } else {
                c.style.background = '#2d3748';
                c.style.borderColor = '#4a5568';
            }
        });

        this.updateSelectionLabel(`${rows} × ${cols} (${totalViewports} viewports)`);
    }

    /**
     * Update selection label
     */
    updateSelectionLabel(text) {
        const label = document.getElementById('gridSelectionLabel');
        if (label) {
            label.textContent = text;
        }
    }

    /**
     * Select grid and apply layout
     */
    selectGrid(event) {
        const cell = event.target;
        const rows = parseInt(cell.dataset.row);
        const cols = parseInt(cell.dataset.col);
        const totalViewports = rows * cols;

        // Check mobile limit
        const isMobile = window.innerWidth < 768;
        if (isMobile && totalViewports > this.mobileMaxViewports) {
            alert(`Mobile devices are limited to ${this.mobileMaxViewports} viewports`);
            return;
        }

        console.log(`Selected grid: ${rows}x${cols} (${totalViewports} viewports)`);

        // Hide popup
        const popup = document.getElementById('gridSelectorPopup');
        if (popup) popup.style.display = 'none';

        // Apply custom grid layout
        this.applyCustomGrid(rows, cols);
    }

    /**
     * Apply custom grid layout
     */
    applyCustomGrid(rows, cols) {
        const viewportManager = window.DICOM_VIEWER.MANAGERS.viewportManager;
        if (!viewportManager) {
            console.error('Viewport manager not found');
            return;
        }

        this.currentCustomGrid = { rows, cols };

        // Generate viewport names
        const viewportNames = [];
        for (let i = 0; i < rows * cols; i++) {
            viewportNames.push(`viewport-${i + 1}`);
        }

        // Add custom layout to layouts
        const layoutKey = `custom-${rows}x${cols}`;
        viewportManager.layouts[layoutKey] = {
            rows: rows,
            cols: cols,
            viewports: viewportNames
        };

        // Create viewports
        viewportManager.createViewports(layoutKey);

        // Update CSS for responsive grid
        this.updateGridCSS(rows, cols);

        // Update button states
        this.updateLayoutButtonStates();

        console.log(`Applied custom grid: ${rows}x${cols}`);
    }

    /**
     * Update CSS for custom grid layout
     */
    updateGridCSS(rows, cols) {
        const container = document.getElementById('viewport-container');
        if (!container) return;

        // Calculate optimal cell size
        const isMobile = window.innerWidth < 768;
        const containerHeight = window.innerHeight - (isMobile ? 100 : 150);
        const containerWidth = container.clientWidth;

        const cellHeight = Math.floor(containerHeight / rows);
        const cellWidth = Math.floor(containerWidth / cols);

        // Apply grid template
        container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        container.style.gap = '2px';
    }

    /**
     * Update layout button states
     */
    updateLayoutButtonStates() {
        // Deactivate all layout buttons
        document.querySelectorAll('[data-layout]').forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        });

        // Activate custom grid button
        const customBtn = document.getElementById('customGridBtn');
        if (customBtn) {
            customBtn.classList.remove('btn-secondary');
            customBtn.classList.add('btn-primary');
        }
    }

    /**
     * Calculate optimal grid for given number of images
     */
    calculateOptimalGrid(imageCount) {
        if (imageCount <= 0) return { rows: 1, cols: 1 };

        const isMobile = window.innerWidth < 768;
        const maxViewports = isMobile ? this.mobileMaxViewports : (this.maxGridSize * this.maxGridSize);

        if (imageCount > maxViewports) {
            imageCount = maxViewports;
        }

        // Calculate square root
        const sqrt = Math.sqrt(imageCount);
        let cols = Math.ceil(sqrt);
        let rows = Math.ceil(imageCount / cols);

        // Optimize for screen orientation
        const isLandscape = window.innerWidth > window.innerHeight;

        if (isLandscape && rows > cols) {
            [rows, cols] = [cols, rows]; // Swap to prefer landscape
        }

        // Limit to max grid size
        cols = Math.min(cols, this.maxGridSize);
        rows = Math.min(rows, this.maxGridSize);

        return { rows, cols };
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.DICOM_VIEWER.MANAGERS.customGridManager) {
            window.DICOM_VIEWER.MANAGERS.customGridManager = new window.DICOM_VIEWER.CustomGridLayoutManager();
            window.DICOM_VIEWER.MANAGERS.customGridManager.initialize();
        }
    });
} else {
    if (!window.DICOM_VIEWER.MANAGERS) {
        window.DICOM_VIEWER.MANAGERS = {};
    }
    window.DICOM_VIEWER.MANAGERS.customGridManager = new window.DICOM_VIEWER.CustomGridLayoutManager();
}

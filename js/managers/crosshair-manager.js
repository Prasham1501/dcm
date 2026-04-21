// Crosshair Manager
window.DICOM_VIEWER.CrosshairManager = class {
    constructor() {
        this.crosshairs = new Map();
        this.enabled = false;
    }

    enable() {
        this.enabled = true;
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    }

    disable() {
        this.enabled = false;
        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        this.hideAllCrosshairs();
    }

    handleMouseMove(event) {
        if (!this.enabled) return;

        const viewports = document.querySelectorAll('.viewport');

        viewports.forEach(viewport => {
            const rect = viewport.getBoundingClientRect();
            const isHovered = (
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom
            );

            if (isHovered) {
                const x = (event.clientX - rect.left) / rect.width;
                const y = (event.clientY - rect.top) / rect.height;
                this.showCrosshair(viewport, x, y);
            } else {
                this.hideCrosshair(viewport);
            }
        });
    }

    showCrosshair(viewport, x, y) {
        let crosshair = this.crosshairs.get(viewport);

        if (!crosshair) {
            crosshair = this.createCrosshair();
            viewport.appendChild(crosshair);
            this.crosshairs.set(viewport, crosshair);
        }

        const horizontal = crosshair.querySelector('.crosshair-h');
        const vertical = crosshair.querySelector('.crosshair-v');

        horizontal.style.top = `${y * 100}%`;
        vertical.style.left = `${x * 100}%`;

        crosshair.style.display = 'block';
    }

    hideCrosshair(viewport) {
        const crosshair = this.crosshairs.get(viewport);
        if (crosshair) {
            crosshair.style.display = 'none';
        }
    }

    hideAllCrosshairs() {
        this.crosshairs.forEach(crosshair => {
            crosshair.style.display = 'none';
        });
    }

    createCrosshair() {
        const container = document.createElement('div');
        container.className = 'crosshair-container';
        container.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 15;
            display: none;
        `;

        const horizontal = document.createElement('div');
        horizontal.className = 'crosshair-h';
        horizontal.style.cssText = `
            position: absolute;
            width: 100%;
            height: 1px;
            background-color: rgba(255, 255, 0, 0.8);
            left: 0;
            transform: translateY(-50%);
        `;

        const vertical = document.createElement('div');
        vertical.className = 'crosshair-v';
        vertical.style.cssText = `
            position: absolute;
            height: 100%;
            width: 1px;
            background-color: rgba(255, 255, 0, 0.8);
            top: 0;
            transform: translateX(-50%);
        `;

        container.appendChild(horizontal);
        container.appendChild(vertical);

        return container;
    }
};
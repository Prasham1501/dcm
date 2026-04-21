// js/managers/reference-lines-manager.js

window.DICOM_VIEWER.ReferenceLinesManager = class {
    constructor() {
        this.isEnabled = false;
        // Use different colors for different source planes for clarity
        this.colors = {
            axial: 'rgba(40, 167, 69, 0.9)',    // Green
            sagittal: 'rgba(255, 193, 7, 0.9)', // Yellow
            coronal: 'rgba(220, 53, 69, 0.9)',  // Red
            default: 'rgba(0, 123, 255, 0.9)'  // Blue for original/other
        };
        this.lineWidth = 1.5;
        console.log('ReferenceLinesManager (FIXED) initialized');
    }

    initialize() {
        cornerstone.events.addEventListener('cornerstoneimagerendered', this.onImageRendered.bind(this));
        cornerstone.events.addEventListener('cornerstonenewimage', this.onNewImage.bind(this));
    }

    enable() {
        if (this.isEnabled) return;
        this.isEnabled = true;
        console.log('Reference Lines ENABLED');
        this.updateAllViewports();
    }

    disable() {
        if (!this.isEnabled) return;
        this.isEnabled = false;
        console.log('Reference Lines DISABLED');
        this.updateAllViewports();
    }

    onNewImage(event) {
        if (!this.isEnabled) return;
        
        const sourceElement = event.target;
        const allViewports = window.DICOM_VIEWER.MANAGERS.viewportManager.getAllViewports();

        // When scrolling in one viewport, trigger an update in all OTHERS
        allViewports.forEach(targetElement => {
            if (targetElement !== sourceElement) {
                try {
                    cornerstone.updateImage(targetElement, true);
                } catch (error) { /* Ignore viewports without images */ }
            }
        });
    }

    onImageRendered(event) {
        if (!this.isEnabled) return;

        const targetElement = event.detail.element;
        const allViewports = window.DICOM_VIEWER.MANAGERS.viewportManager.getAllViewports();

        allViewports.forEach(sourceElement => {
            // Don't draw a reference line of an element on itself
            if (sourceElement === targetElement) return;

            // Ensure both viewports are enabled and have images
            try {
                const sourceImage = cornerstone.getImage(sourceElement);
                const targetImage = cornerstone.getImage(targetElement);

                if (!sourceImage || !targetImage) return;

                // Get the canvas context to draw on
                const context = event.detail.canvasContext.canvas.getContext('2d');
                context.setTransform(1, 0, 0, 1, 0, 0);

                // Get the image plane metadata
                const sourceImagePlane = cornerstone.metaData.get('imagePlaneModule', sourceImage.imageId);
                const targetImagePlane = cornerstone.metaData.get('imagePlaneModule', targetImage.imageId);

                if (!sourceImagePlane || !targetImagePlane) return;

                // Calculate the start and end points of the reference line
                const { p1, p2 } = this.getIntersectionPoints(sourceImagePlane, targetImagePlane, targetImage);

                // If we have valid points, draw the line
                if (p1 && p2) {
                    const color = this.colors[sourceElement.dataset.viewportName] || this.colors.default;
                    this.drawLine(context, targetElement, p1, p2, color);
                }

            } catch (error) { /* Fails gracefully if an element isn't ready */ }
        });
    }

    getIntersectionPoints(sourcePlane, targetPlane, targetImage) {
        const sourceNormal = new cornerstoneMath.Vector3(
            sourcePlane.rowCosines.x, sourcePlane.rowCosines.y, sourcePlane.rowCosines.z
        ).cross(new cornerstoneMath.Vector3(
            sourcePlane.columnCosines.x, sourcePlane.columnCosines.y, sourcePlane.columnCosines.z
        ));
        
        const sourcePoint = sourcePlane.imagePositionPatient;
        const plane = {
            normal: sourceNormal,
            point: sourcePoint
        };

        const targetCorners = [
            targetPlane.imagePositionPatient, // Top-left
            cornerstone.getPatientPoint(targetPlane.imagePositionPatient, targetPlane.columnCosines, targetPlane.pixelSpacing, {x: targetImage.width, y: 0}), // Top-right
            cornerstone.getPatientPoint(targetPlane.imagePositionPatient, targetPlane.rowCosines, targetPlane.pixelSpacing, {x: 0, y: targetImage.height}), // Bottom-left
            cornerstone.getPatientPoint(targetPlane.imagePositionPatient, targetPlane.columnCosines, targetPlane.pixelSpacing, {x: targetImage.width, y: targetImage.height}) // Bottom-right, approximation
        ];

        const targetEdges = [
            { p1: targetCorners[0], p2: targetCorners[1] }, // Top
            { p1: targetCorners[0], p2: targetCorners[2] }, // Left
            { p1: targetCorners[1], p2: targetCorners[3] }, // Right
            { p1: targetCorners[2], p2: targetCorners[3] }  // Bottom
        ];

        const intersectionPoints = [];
        targetEdges.forEach(edge => {
            const intersection = this.linePlaneIntersection(edge, plane);
            if (intersection) {
                intersectionPoints.push(intersection);
            }
        });

        if (intersectionPoints.length < 2) return {};
        
        return { p1: intersectionPoints[0], p2: intersectionPoints[1] };
    }

    linePlaneIntersection(line, plane) {
        const lineDirection = new cornerstoneMath.Vector3().subVectors(line.p2, line.p1);
        const dot = lineDirection.dot(plane.normal);

        if (Math.abs(dot) < 1e-6) {
            // Line is parallel to the plane
            return null;
        }

        const w = new cornerstoneMath.Vector3().subVectors(line.p1, plane.point);
        const fac = -plane.normal.dot(w) / dot;
        
        // Check if intersection point is within the line segment
        if (fac < 0 || fac > 1) {
            return null;
        }
        
        lineDirection.multiplyScalar(fac);
        return new cornerstoneMath.Vector3().addVectors(line.p1, lineDirection);
    }
    
    drawLine(context, targetElement, p1_patient, p2_patient, color) {
        // Convert the 3D patient points to 2D pixel coordinates on the target viewport
        const p1_pixel = cornerstone.worldToPixel(targetElement, p1_patient);
        const p2_pixel = cornerstone.worldToPixel(targetElement, p2_patient);
        
        // Draw the line
        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = this.lineWidth;
        context.moveTo(p1_pixel.x, p1_pixel.y);
        context.lineTo(p2_pixel.x, p2_pixel.y);
        context.stroke();
    }

    updateAllViewports() {
        const allViewports = window.DICOM_VIEWER.MANAGERS.viewportManager.getAllViewports();
        allViewports.forEach(element => {
            try {
                cornerstone.updateImage(element, true);
            } catch (error) { /* Ignore viewports without images */ }
        });
    }
};
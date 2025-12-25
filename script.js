// # Default state
let settings = {
    background: '#111',
    rotationX: 30,
    treeShape: 't => t',
    rotationSpeed: 0.5,
    showFPS: true,
    treeScale: 0.7
};

// Star settings
let starSettings = {
    color: '#FFD700',
    glowColor: '#FFFF00',
    size: 35,
    glowSize: 12,
    opacity: 1,
    rotationSpeed: 0.2,
    pulseSpeed: 1.5,
    pulseAmount: 0.15,
    showStar: true,
    showGlow: true
};

let chains = [
    { 
        bulbRadius: 2, 
        bulbsCount: 100, 
        endColor: "#FFCC00", 
        glowOffset: 10, 
        opacity: 1, 
        startAngle: 0, 
        startColor: "#FFCC00", 
        turnsCount: 14,
        name: "Gold Chain"
    },
    { 
        bulbRadius: 8, 
        bulbsCount: 40, 
        endColor: "#00FFFF", 
        glowOffset: 15, 
        opacity: 0.8, 
        startAngle: 120, 
        startColor: "#FFFF00", 
        turnsCount: 3,
        name: "Cyan Ribbon"
    },
    { 
        bulbRadius: 5, 
        bulbsCount: 60, 
        endColor: "#FFFF00", 
        glowOffset: 8, 
        opacity: 0.9, 
        startAngle: 240, 
        startColor: "#00FFFF", 
        turnsCount: -5,
        name: "Spiral Ribbon"
    }
];

// # Global vars
const canvasContainer = document.querySelector('.canvas-container');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let rotationZ = 0;
let starRotation = 0;
let starPulse = 0;
let isInitialized = false;
let animationId = null;
let lastTime = 0;
let frameCount = 0;
let fps = 60;
let isPaused = false;

// Explosion effect
let explosionFactor = 0; // 0 = normal, 1 = fully exploded
let targetExplosionFactor = 0;
const EXPLOSION_SPEED = 0.1; // How fast explosion animates
const EXPLOSION_AMOUNT = 2.5; // How far elements spread when exploded

// Image portraits
let portraitImages = [];
let imagesLoaded = 0;
// Dynamically load all images from assets folder
// List of all image files in assets folder (excluding HEIC as browsers don't support it)
const imagePaths = [
    './assets/1fd8b5e9cd2f1e020671820480cb8ae4.JPG',
    './assets/IMG_0502.JPG',
    './assets/IMG_0554.JPG',
    './assets/IMG_0626.JPG',
    './assets/IMG_0757.JPG',
    './assets/IMG_0766.JPG',
    './assets/IMG_0859.JPG',
    './assets/IMG_0884.JPG',
    './assets/IMG_0923.JPG',
    './assets/IMG_1107.JPG',
    './assets/IMG_2975.JPG',
    './assets/IMG_3163.JPG',
    './assets/IMG_3694.JPG',
    './assets/IMG_3770.JPG',
    './assets/IMG_3803.JPG',
    './assets/IMG_3806.JPG',
    './assets/IMG_3811.JPG',
    './assets/IMG_3883.JPG',
    './assets/IMG_3891.JPG',
    './assets/IMG_3920.JPG',
    './assets/IMG_3958.JPG',
    './assets/IMG_3984.JPG',
    './assets/IMG_8598.JPG',
    './assets/IMG_8648.JPG',
    './assets/IMG_8752.JPG',
    './assets/IMG_8839.JPG',
    './assets/IMG_8870.JPG',
    './assets/IMG_9212.JPG',
    './assets/sd1761507669_2.JPG'
];

// Portrait settings
let portraitSettings = {
    size: 60,
    frameWidth: 8,
    frameColor: '#8B4513',
    showPortraits: true,
    opacity: 0.95,
    spacing: 0.25 // spacing along tree height (0-1)
};

// Load images
function loadImages() {
    imagePaths.forEach((path, index) => {
        const img = new Image();
        img.onload = () => {
            imagesLoaded++;
            if (imagesLoaded === imagePaths.length) {
                // Make portraitImages globally accessible for hand detection
                window.portraitImages = portraitImages;
                render(); // Re-render when all images are loaded
            }
        };
        img.onerror = () => {
            console.warn(`Failed to load image: ${path}`);
            imagesLoaded++;
        };
        img.src = path;
        portraitImages.push(img);
    });
}

// Get canvas dimensions from container
function getCanvasDimensions() {
    const rect = canvasContainer.getBoundingClientRect();
    return {
        width: rect.width,
        height: rect.height
    };
}

// Color utilities
const ColorUtils = {
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    },

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },

    mixColors(color1, color2, weight) {
        const c1 = this.hexToRgb(color1);
        const c2 = this.hexToRgb(color2);
        
        const w1 = weight;
        const w2 = 1 - weight;
        
        const r = Math.round(c1.r * w1 + c2.r * w2);
        const g = Math.round(c1.g * w1 + c2.g * w2);
        const b = Math.round(c1.b * w1 + c2.b * w2);
        
        return this.rgbToHex(r, g, b);
    },

    withOpacity(hex, opacity) {
        const rgb = this.hexToRgb(hex);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
    }
};

// Hide loading screen when ready
function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
    }, 500);
}

// # Customisation via dat.GUI
function getRandomChain() {
    const colorPairs = [
        { start: '#FF6B6B', end: '#4ECDC4' },
        { start: '#45B7D1', end: '#96C93D' },
        { start: '#FF9A9E', end: '#FAD0C4' },
        { start: '#A1C4FD', end: '#C2E9FB' },
        { start: '#FFD89B', end: '#19547B' }
    ];
    
    const colors = colorPairs[Math.floor(Math.random() * colorPairs.length)];
    
    return {
        bulbsCount: Math.round(Math.random() * (100 - 20) + 20),
        bulbRadius: Math.round(Math.random() * (15 - 2) + 2),
        glowOffset: Math.random() < 0.5 ? 0 : Math.round(Math.random() * (30 - 5) + 5),
        turnsCount: Math.round(Math.random() * (10 - 3) + 3) * (Math.random() < 0.5 ? -1 : 1),
        startAngle: Math.round(Math.random() * 360),
        startColor: colors.start,
        endColor: colors.end,
        opacity: Math.round(Math.random() * (100 - 60) + 60) / 100,
        name: `Chain ${chains.length + 1}`
    };
}


// # Rendering of the tree
function updateScene() {
    const dims = getCanvasDimensions();
    const canvasWidth = dims.width;
    const canvasHeight = dims.height;
    
    // Update global variables for tree geometry
    window.tiltAngle = settings.rotationX / 180 * Math.PI;
    window.treeHeight = Math.min(canvasWidth, canvasHeight) * settings.treeScale;
    window.baseRadius = treeHeight * 0.35;
    
    // Calculate center with proper margins for star
    const topMargin = starSettings.size + starSettings.glowSize + 20;
    const bottomMargin = baseRadius + 20;
    
    window.baseCenter = {
        x: canvasWidth / 2,
        y: canvasHeight - bottomMargin - treeHeight * 0.5
    };
    
    // Ensure star fits within canvas
    const starTop = baseCenter.y - treeHeight;
    if (starTop < topMargin) {
        // Adjust tree position if star would overflow
        window.baseCenter.y += (topMargin - starTop);
    }
    
    // Set canvas dimensions
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
}

// Draw a beautiful star
function drawStar(x, y, radius, points, rotation) {
    const outerRadius = radius;
    const innerRadius = radius * 0.5;
    
    ctx.beginPath();
    
    for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points + rotation;
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    
    ctx.closePath();
    ctx.fill();
    
    // Add shine effect
    const shineRadius = radius * 0.3;
    const shineGradient = ctx.createRadialGradient(
        x - radius * 0.2, y - radius * 0.2, 0,
        x - radius * 0.2, y - radius * 0.2, shineRadius
    );
    
    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = shineGradient;
    ctx.beginPath();
    ctx.arc(x - radius * 0.2, y - radius * 0.2, shineRadius, 0, Math.PI * 2);
    ctx.fill();
}

// Draw star glow/halo effect
function drawStarGlow(x, y, radius) {
    const glowGradient = ctx.createRadialGradient(
        x, y, radius * 0.3,
        x, y, radius
    );
    
    glowGradient.addColorStop(0, ColorUtils.withOpacity(starSettings.glowColor, 0.8));
    glowGradient.addColorStop(0.5, ColorUtils.withOpacity(starSettings.glowColor, 0.4));
    glowGradient.addColorStop(1, ColorUtils.withOpacity(starSettings.glowColor, 0));
    
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

// Draw the star on top of the tree
function drawStarOnTree() {
    if (!starSettings.showStar) return;
    
    ctx.save();
    
    // Calculate star position (top of the tree)
    let starX = baseCenter.x;
    let starY = baseCenter.y - treeHeight;
    
    // Apply explosion effect to star
    if (explosionFactor > 0) {
        const centerX = baseCenter.x;
        const centerY = baseCenter.y;
        const dx = starX - centerX;
        const dy = starY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const explosionOffset = distance * explosionFactor * EXPLOSION_AMOUNT;
        starX += Math.cos(angle) * explosionOffset;
        starY += Math.sin(angle) * explosionOffset;
    }
    
    // Add pulse effect
    const pulseScale = 1 + Math.sin(starPulse) * starSettings.pulseAmount;
    const currentSize = starSettings.size * pulseScale;
    
    // Draw glow/halo if enabled
    if (starSettings.showGlow) {
        ctx.globalAlpha = starSettings.opacity * 0.7;
        drawStarGlow(starX, starY, currentSize + starSettings.glowSize);
    }
    
    // Draw the star
    ctx.globalAlpha = starSettings.opacity;
    ctx.fillStyle = starSettings.color;
    drawStar(starX, starY, currentSize, 5, starRotation);
    
    ctx.restore();
}

// Draw hanging portraits on the tree
function drawPortraits() {
    if (!portraitSettings.showPortraits || imagesLoaded !== imagePaths.length) return;
    
    // Check if special gesture is active - show image fullscreen
    if (window.handDetection && window.handDetection.showRandomImage && 
        window.handDetection.randomImageIndex !== null) {
        // Don't draw portraits on tree, image will be drawn fullscreen in render function
        return;
    }
    
    const easing = eval(settings.treeShape);
    const portraitCount = portraitImages.length;
    
    // Distribute portraits evenly along the tree height
    const positions = [];
    for (let i = 0; i < portraitCount; i++) {
        // Space them out along the tree, avoiding the very top and bottom
        const progress = 0.15 + (i + 1) * (0.75 / (portraitCount + 1));
        positions.push(progress);
    }
    
    positions.forEach((progress, index) => {
        if (!portraitImages[index] || !portraitImages[index].complete) return;
        
        ctx.save();
        
        // Calculate position similar to bulbs but with slight offset for hanging effect
        const turnProgress = (progress * 3) % 1; // 3 turns around the tree
        const sectionRadius = baseRadius * (1 - easing(progress));
        const sectionAngle = ((turnProgress * 360 + rotationZ) / 180 * Math.PI) % (Math.PI * 2);
        
        // Calculate portrait position
        let portraitX = baseCenter.x + (Math.sin(sectionAngle) * sectionRadius);
        let portraitY = baseCenter.y - progress * treeHeight * Math.sin((90 - settings.rotationX) / 180 * Math.PI)
            + sectionRadius * Math.sin(tiltAngle) * Math.cos(sectionAngle);
        
        // Apply explosion effect - spread portraits outward from center
        if (explosionFactor > 0) {
            const centerX = baseCenter.x;
            const centerY = baseCenter.y;
            const dx = portraitX - centerX;
            const dy = portraitY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            const explosionOffset = distance * explosionFactor * EXPLOSION_AMOUNT;
            portraitX += Math.cos(angle) * explosionOffset;
            portraitY += Math.sin(angle) * explosionOffset;
        }
        
        // Adjust size based on tree scale
        const portraitSize = portraitSettings.size * (treeHeight / 1000);
        const frameSize = portraitSize + portraitSettings.frameWidth * 2;
        
        // Draw hanging string/rope
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const stringLength = portraitSize * 0.3;
        const stringTopY = portraitY - frameSize / 2 - stringLength;
        const stringTopX = portraitX;
        ctx.moveTo(stringTopX, stringTopY);
        ctx.lineTo(portraitX, portraitY - frameSize / 2);
        ctx.stroke();
        
        // Draw frame shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(
            portraitX - frameSize / 2 + 3,
            portraitY - frameSize / 2 + 3,
            frameSize,
            frameSize
        );
        
        // Draw frame
        ctx.fillStyle = portraitSettings.frameColor;
        ctx.fillRect(
            portraitX - frameSize / 2,
            portraitY - frameSize / 2,
            frameSize,
            frameSize
        );
        
        // Draw inner frame border (golden accent)
        ctx.strokeStyle = '#DAA520';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            portraitX - frameSize / 2 + portraitSettings.frameWidth,
            portraitY - frameSize / 2 + portraitSettings.frameWidth,
            frameSize - portraitSettings.frameWidth * 2,
            frameSize - portraitSettings.frameWidth * 2
        );
        
        // Draw the image
        ctx.globalAlpha = portraitSettings.opacity;
        ctx.drawImage(
            portraitImages[index],
            portraitX - portraitSize / 2,
            portraitY - portraitSize / 2,
            portraitSize,
            portraitSize
        );
        
        // Add subtle glow around portrait
        ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
            portraitX - frameSize / 2,
            portraitY - frameSize / 2,
            frameSize,
            frameSize
        );
        ctx.shadowBlur = 0;
        
        ctx.restore();
    });
}

function renderChain(props) {
    if (!props.bulbsCount || props.bulbsCount <= 0) return;
    
    const easing = eval(settings.treeShape);
    
    for (let i = 0; i < props.bulbsCount; i++) {
        let progress = i / (props.bulbsCount - 1);
        
        // Adjust progress for better distribution
        progress = Math.pow(progress, Math.sqrt(progress) + 0.5);
        
        const turnProgress = (progress * props.turnsCount) % 1;
        const sectionRadius = baseRadius * (1 - easing(progress));
        const sectionAngle = ((turnProgress * 360 + props.startAngle + rotationZ) / 180 * Math.PI) % (Math.PI * 2);
        
        // Calculate bulb position
        let X = baseCenter.x + (Math.sin(sectionAngle) * sectionRadius);
        let Y = baseCenter.y - progress * treeHeight * Math.sin((90 - settings.rotationX) / 180 * Math.PI)
            + sectionRadius * Math.sin(tiltAngle) * Math.cos(sectionAngle);
        
        // Apply explosion effect - spread elements outward from center
        if (explosionFactor > 0) {
            const centerX = baseCenter.x;
            const centerY = baseCenter.y;
            const dx = X - centerX;
            const dy = Y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            const explosionOffset = distance * explosionFactor * EXPLOSION_AMOUNT;
            X += Math.cos(angle) * explosionOffset;
            Y += Math.sin(angle) * explosionOffset;
        }
        
        const bulbRadius = Math.max(1, props.bulbRadius * treeHeight / 1000);
        const glowRadius = bulbRadius + (props.glowOffset * treeHeight / 1000);
        
        // Mix colors based on progress
        const currentColor = ColorUtils.mixColors(props.startColor, props.endColor, progress);
        
        // Set global alpha for this chain
        ctx.globalAlpha = props.opacity;
        
        // Draw glow effect
        if (props.glowOffset > 0 && glowRadius > bulbRadius) {
            const gradient = ctx.createRadialGradient(
                X, Y, bulbRadius,
                X, Y, glowRadius
            );
            
            gradient.addColorStop(0, ColorUtils.withOpacity(currentColor, 0.8));
            gradient.addColorStop(0.5, ColorUtils.withOpacity(currentColor, 0.4));
            gradient.addColorStop(1, ColorUtils.withOpacity(currentColor, 0));
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(X, Y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw bulb
        ctx.fillStyle = currentColor;
        ctx.beginPath();
        ctx.arc(X, Y, bulbRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add subtle highlight
        if (bulbRadius > 3) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(X - bulbRadius * 0.3, Y - bulbRadius * 0.3, bulbRadius * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function render() {
    if (!isInitialized) return;
    
    // Check if special gesture is active - show image fullscreen
    if (window.handDetection && window.handDetection.showRandomImage && 
        window.handDetection.randomImageIndex !== null) {
        const index = window.handDetection.randomImageIndex;
        if (portraitImages[index] && portraitImages[index].complete) {
            // Draw fullscreen black background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Calculate fullscreen dimensions with aspect ratio preserved
            const img = portraitImages[index];
            const imgAspect = img.width / img.height;
            const canvasAspect = canvas.width / canvas.height;
            
            let drawWidth, drawHeight, drawX, drawY;
            
            if (imgAspect > canvasAspect) {
                // Image is wider - fit to width
                drawWidth = canvas.width * 0.95; // 95% of canvas width
                drawHeight = drawWidth / imgAspect;
                drawX = (canvas.width - drawWidth) / 2;
                drawY = (canvas.height - drawHeight) / 2;
            } else {
                // Image is taller - fit to height
                drawHeight = canvas.height * 0.95; // 95% of canvas height
                drawWidth = drawHeight * imgAspect;
                drawX = (canvas.width - drawWidth) / 2;
                drawY = (canvas.height - drawHeight) / 2;
            }
            
            // Draw the image fullscreen
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            
            return; // Don't draw tree or other elements
        }
    }
    
    updateScene();
    
    // Clear canvas with background
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Reset global alpha
    ctx.globalAlpha = 1;
    
    // Render all chains
    chains.forEach(chain => renderChain(chain));
    
    // Draw hanging portraits
    drawPortraits();
    
    // Draw the star on top
    drawStarOnTree();
}

function animate(currentTime) {
    if (!isPaused) {
        // Base rotation speed
        let rotationSpeed = settings.rotationSpeed;
        
        // Apply rotation speed adjustment from left hand up/down movement
        if (window.handDetection && window.handDetection.treeRotationSpeed) {
            // Add rotation speed adjustment (scaled down for smoother control)
            // Moving hand up = positive speed = faster rotation
            rotationSpeed += window.handDetection.treeRotationSpeed * 0.01;
        }
        
        // Apply rotation offset from left hand left/right movement
        if (window.handDetection && window.handDetection.treeRotationOffset) {
            // Add rotation offset (scaled down for smoother control)
            // Moving right = positive offset = rotate right (counter-clockwise)
            rotationSpeed += window.handDetection.treeRotationOffset * 0.01;
        }
        
        rotationZ = (rotationZ - rotationSpeed) % 360;
        starRotation = (starRotation + starSettings.rotationSpeed * 0.05) % (Math.PI * 2);
        starPulse = (starPulse + starSettings.pulseSpeed * 0.05) % (Math.PI * 2);
        
        // Get target explosion factor from hand detection
        if (window.handDetection) {
            targetExplosionFactor = window.handDetection.targetExplosionFactor || 0;
        }
        
        // Smoothly animate explosion factor
        explosionFactor += (targetExplosionFactor - explosionFactor) * EXPLOSION_SPEED;
        
        render();
    }
    animationId = requestAnimationFrame(animate);
}

// Initialize the application
function init() {
    // Load images first
    loadImages();
    
    updateScene();
    render();
    
    // Start animation
    lastTime = performance.now();
    animate();
    
    isInitialized = true;
    hideLoading();
    
    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateScene();
            render();
        }, 100);
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
            isPaused = !isPaused;
            if (!isPaused) {
                animate();
            }
        }
    });
    
    // Add canvas click to pause/resume animation
    canvas.addEventListener('click', () => {
        isPaused = !isPaused;
        if (!isPaused) {
            animate();
        }
    });
    
}

// Start initialization
init();
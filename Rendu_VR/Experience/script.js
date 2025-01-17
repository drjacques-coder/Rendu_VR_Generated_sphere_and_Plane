// Consolidated scene setup
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true }); // Add antialias for better quality
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a2a);
document.body.appendChild(renderer.domElement);

// Optimized camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';

// Simplified color generation
function generateRandomColor() {
    return new THREE.Color(
        Math.random() * 0.7 + 0.3, // More saturated colors
        Math.random() * 0.7 + 0.3,
        Math.random() * 0.7 + 0.3
    );
}
let currentColor = generateRandomColor();
let nextWorldColor = generateRandomColor();

// Add color transition variables
let currentSkyColor = generateSkyColor(currentColor);
let nextSkyColor = generateSkyColor(nextWorldColor);

// Add after scene setup
function showWelcomeMessage() {
    const message = document.getElementById('welcome-message');
    message.classList.add('visible');
    setTimeout(() => {
        message.classList.remove('visible');
    }, 5000);
}

// Audio setup
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();
const sound = new THREE.Audio(listener);
camera.add(listener);
let audioInitialized = false;

// Audio initialization
function initAudio() {
    if (audioInitialized) return;
    console.log('Initializing audio...');
    
    audioLoader.load('/Assets/AK - Afterthought.mp3', // Updated path
        buffer => {
            console.log('Audio loaded successfully');
            sound.setBuffer(buffer);
            sound.setLoop(true);
            sound.setVolume(0.5);
            sound.play();
            audioInitialized = true;
        },
        progress => console.log(`Loading: ${(progress.loaded / progress.total * 100).toFixed(2)}%`),
        error => console.error('Error:', error)
    );
}

// Auto-start audio
document.addEventListener('click', () => {
    if (!audioInitialized) {
        listener.context.resume().then(() => {
            console.log('Audio context resumed');
            initAudio();
        });
    }
}, { once: true });

// Plane Variables
let plane;
let sphere; // Define the sphere variable here
const planeSize = 1500; // Size of the plane
const teleportMargin = 10; // Margin before teleporting to the other side
const simplexNoise = new SimplexNoise(); // Noise for terrain variation (consider caching for performance)

// Jump Variables
const initialJumpHeight = 20; // Initial height of the jump
const initialGravity = 100; // Initial gravity affecting the jump
let jumpHeight = initialJumpHeight;
let gravity = initialGravity;
let isJumping = false; // Flag to check if the player is jumping
let verticalVelocity = 0; // Vertical velocity of the player
let isFirstGeneration = true; // Flag to check if it's the first generation

// Add at the top with other variables
let distanceTraveled = 0;
let planesGenerated = 0;
let highestPoint = 0;

// Add at top with other variables
let sphereGeometry;
let sphereMaterial;
let sphereNoiseTime = 0;

// Clock for animations
const clock = new THREE.Clock();

// Add after other variable declarations
const cursorTimer = document.getElementById('cursor-timer');

function generateSkyColor(color) {
    let skycolor = new THREE.Color(color);
    let HSL=skycolor.getHSL(skycolor);
    skycolor.setHSL((HSL.h + 0.1)%360, HSL.s, HSL.l);
    return skycolor;
}


// Function to generate a plane with noise
function generatePlane(spherePosition) {
    if (plane) scene.remove(plane);
    if (sphere) scene.remove(sphere);
    
    // Transition sky color
    renderer.setClearColor(currentSkyColor);

    // Use current color for plane and prepare next color
    const planeColor = currentColor;
    currentColor = nextWorldColor;
    nextWorldColor = generateRandomColor();

    // Update sky color
    currentSkyColor = nextSkyColor;
    nextSkyColor = generateSkyColor(nextWorldColor); 

    // Create sphere with next color (preview of next world)
    sphere = generateNoisySphere(spherePosition, nextWorldColor);
    if (sphere) scene.add(sphere);

    // Create new plane
    const maxHeight = Math.random() * 20 + 15; // Max height between 15 and 35 for more variability
    const minHeight = -(Math.random() * 20 + 10); // Min height between -10 and -30 for more variability
    if (plane) scene.remove(plane); // Remove the previous plane
    if (sphere) scene.remove(sphere); // Remove the previous sphere

    const geometry = new THREE.PlaneGeometry(planeSize, planeSize, 200, 200);
    geometry.rotateX(-Math.PI / 2); // Rotate to make it horizontal

    const vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i);
        const z = vertices.getZ(i);
        const variableDepth = simplexNoise.noise2D(x / 100, z / 100) * 5; // Add variability to the depth
        const rawY = simplexNoise.noise2D(x / 50, z / 50) * (maxHeight - minHeight) + minHeight + variableDepth; // Simplified noise calculation for performance
        const y = Math.max(rawY, 0); // Flattenm lower elevations
        vertices.setY(i, y);
    }
    vertices.needsUpdate = true;

    const colorArray = new Float32Array(vertices.count * 3);
    for (let i = 0; i < vertices.count; i++) {
        const y = vertices.getY(i);
        const normalizedHeight = Math.max(0, Math.min(1, y / 20)); // Normalize height to 0-1 range
        const color = new THREE.Color(
            normalizedHeight * planeColor.r, // Red component
            normalizedHeight * planeColor.g, // Green component
            normalizedHeight * planeColor.b  // Blue component
        );
        colorArray.set([color.r, color.g, color.b], i * 3); // Streamlined color setting
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        wireframe: false,
    });

    plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    // Use raycaster to determine sphere height
    const raycaster = new THREE.Raycaster();
    const downVector = new THREE.Vector3(0, -1, 0);
    raycaster.set(spherePosition.clone().setY(1000), downVector);
    const intersects = raycaster.intersectObject(plane);

    // Adjust sphere position based on terrain height
    if (intersects.length > 0) {
        const groundHeight = intersects[0].point.y;
        spherePosition.setY(groundHeight + 5);
    }

    // Generate and add noisy sphere
    sphere = generateNoisySphere(spherePosition, currentColor);
    scene.add(sphere);

    // Update parameters
    if (!isFirstGeneration) {
        jumpHeight = Math.random() * 40 + 10;
        gravity = gravity > 100 ? Math.random() * 100 : Math.random() * 100 + 100;
    }
    isFirstGeneration = false;
    planesGenerated++;

    return { plane, sphere };
}

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 2); // Strong directional light
light.position.set(50, 200, 50); // Position above and angled
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Stronger ambient light
scene.add(ambientLight);

// First-Person Walking Controls
const controls = new THREE.PointerLockControls(camera, document.body);
controls.pointerSpeed = 1.0; // Stabilize mouse sensitivity

document.body.addEventListener('click', () => {
    controls.lock(); // Locks the pointer when clicking the canvas
});
scene.add(controls.getObject());

// Debug flag
const debug = false;


// Responsive Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Teleport Function
function handleTeleport() {
    const position = controls.getObject().position;

    // Wrap to the other side instead of teleporting
    if (position.x > planeSize / 2) position.x -= planeSize;
    if (position.x < -planeSize / 2) position.x += planeSize;
    if (position.z > planeSize / 2) position.z -= planeSize;
    if (position.z < -planeSize / 2) position.z += planeSize;
}

// Add raycaster initialization
const raycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0); // Cast downward

// Detect When the Player Looks at the Sphere
let lookAtSphereTime = 0;
const lookDuration = 3; // 3 seconds
const minDistance = 10; // Minimum distance to start the watching timer

// Update checkLookingAtSphere function
function checkLookingAtSphere() {
    if (!sphere) return;
    
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObject(sphere);
    const progressRing = document.getElementById('progress-ring');
    const progressCircle = progressRing.querySelector('.progress');
    const circumference = 2 * Math.PI * 13;
    
    if (intersects.length > 0) {
        const distance = controls.getObject().position.distanceTo(sphere.position);
        if (distance <= minDistance) {
            lookAtSphereTime += clock.getDelta();
            progressRing.classList.add('active');
            const progress = lookAtSphereTime / lookDuration;
            const dashOffset = circumference * (1 - progress);
            progressCircle.style.strokeDasharray = circumference;
            progressCircle.style.strokeDashoffset = dashOffset;
            
            if (lookAtSphereTime >= lookDuration) {
                teleportPlayer();
            }
        } else {
            resetTimer();
        }
    } else {
        resetTimer();
    }
}

// Add reset timer function
function resetTimer() {
    lookAtSphereTime = 0;
    const progressRing = document.getElementById('progress-ring');
    progressRing.classList.remove('active');
}

// Update teleportPlayer function
function teleportPlayer() {
    resetTimer();
    const newSpherePosition = new THREE.Vector3(
        (Math.random() - 0.5) * planeSize / 2,
        10,
        (Math.random() - 0.5) * planeSize / 2
    );
    
    // Use stored color for generation
    generatePlane(newSpherePosition);
    
    controls.getObject().position.set(0, 10, 0);
    lookAtSphereTime = 0;
}

// Add function to generate noisy sphere
function generateNoisySphere(position, colors) {
    if (!sphereGeometry) {
        sphereGeometry = new THREE.SphereGeometry(5, 64, 64);
    }

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            baseColor: { value: new THREE.Color(colors) }
        },
        vertexShader: `
            uniform float time;
            varying vec3 vNormal;
            varying float noise;
            
            // Simplex 3D noise function
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
            vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
            
            float snoise(vec3 v) {
                const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
                
                vec3 i  = floor(v + dot(v, C.yyy));
                vec3 x0 = v - i + dot(i, C.xxx);
                
                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min(g.xyz, l.zxy);
                vec3 i2 = max(g.xyz, l.zxy);
                
                vec3 x1 = x0 - i1 + C.xxx;
                vec3 x2 = x0 - i2 + C.yyy;
                vec3 x3 = x0 - D.yyy;
                
                i = mod289(i);
                vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                    
                float n_ = 0.142857142857;
                vec3 ns = n_ * D.wyz - D.xzx;
                
                vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                
                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_);
                
                vec4 x = x_ *ns.x + ns.yyyy;
                vec4 y = y_ *ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);
                
                vec4 b0 = vec4(x.xy, y.xy);
                vec4 b1 = vec4(x.zw, y.zw);
                
                vec4 s0 = floor(b0)*2.0 + 1.0;
                vec4 s1 = floor(b1)*2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));
                
                vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
                
                vec3 p0 = vec3(a0.xy, h.x);
                vec3 p1 = vec3(a0.zw, h.y);
                vec3 p2 = vec3(a1.xy, h.z);
                vec3 p3 = vec3(a1.zw, h.w);
                
                vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                p0 *= norm.x;
                p1 *= norm.y;
                p2 *= norm.z;
                p3 *= norm.w;
                
                vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                m = m * m;
                return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
            }
            
            void main() {
                vNormal = normal;
                vec3 pos = position;
                float noiseScale = 2.0;
                noise = snoise(pos * noiseScale + time * 0.5);
                pos += normal * noise * 2.0;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 baseColor;
            varying vec3 vNormal;
            varying float noise;
            
            void main() {
                vec3 light = normalize(vec3(1.0, 1.0, 1.0));
                float intensity = dot(vNormal, light);
                vec3 color = mix(baseColor, vec3(1.0), intensity);
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });

    material.side = THREE.DoubleSide;
    material.transparent = false;

    const mesh = new THREE.Mesh(sphereGeometry, material);
    mesh.position.copy(position);
    
    // Add these properties for proper interaction
    mesh.userData.isInteractive = true;
    mesh.layers.enable(0);
    
    return mesh;
}

// Add function to update metrics
function updateMetrics() {
    // Update distance
    const currentPosition = controls.getObject().position;
    distanceTraveled += Math.sqrt(
        Math.pow(movement.forward, 2) + 
        Math.pow(movement.right, 2)
    ) * (1/60); // Assuming 60 FPS

    // Update highest point
    highestPoint = Math.max(highestPoint, currentPosition.y);

    // Update DOM
    document.getElementById('distance').textContent = distanceTraveled.toFixed(2);
    document.getElementById('planes').textContent = planesGenerated;
    document.getElementById('height').textContent = highestPoint.toFixed(2);
}


// Movement state
const movement = {
    forward: 0,
    right: 0
};

// Speed constants
const MOVEMENT = {
    speed: 20,
    jumpSpeed: 20
};

// Event listeners
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW':
            movement.forward = 1;
            break;
        case 'KeyS':
            movement.forward = -1;
            break;
        case 'KeyA':
            movement.right = -1;
            break;
        case 'KeyD':
            movement.right = 1;
            break;
        case 'Space':
            if (!isJumping) {
                isJumping = true;
                verticalVelocity = jumpHeight;
            }
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW':
        case 'KeyS':
            movement.forward = 0;
            break;
        case 'KeyA':
        case 'KeyD':
            movement.right = 0;
            break;
    }
});

function handleMovement(delta) {
    if (!controls.isLocked) return;

    const moveDirection = new THREE.Vector3();
    controls.getDirection(moveDirection);
    moveDirection.y = 0;
    moveDirection.normalize();

    if (movement.forward !== 0) {
        controls.getObject().position.addScaledVector(
            moveDirection,
            movement.forward * MOVEMENT.speed * delta
        );
    }

    if (movement.right !== 0) {
        const rightVector = new THREE.Vector3(-moveDirection.z, 0, moveDirection.x);
        controls.getObject().position.addScaledVector(
            rightVector,
            movement.right * MOVEMENT.speed * delta
        );
    }
}

// Update animation loop
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    handleMovement(delta);
    
    // Update sphere shader time uniform
    if (sphere && sphere.material.uniforms) {
        sphere.material.uniforms.time.value += delta;
    }

    // Use raycasting for height adjustment
    raycaster.set(controls.getObject().position, downVector);
    const intersects = raycaster.intersectObject(plane); // Use plane as the terrain object

    let groundHeight = 0; // Default ground height
    if (intersects.length > 0) {
        groundHeight = intersects[0].point.y;
    }
    const cameraHeightOffset = 5; // Adjust for preferred camera height

    // Handle jumping
    if (isJumping) {
        controls.getObject().position.y += verticalVelocity * delta;
        verticalVelocity -= gravity * delta;
        if (controls.getObject().position.y <= groundHeight + cameraHeightOffset) {
            controls.getObject().position.y = groundHeight + cameraHeightOffset;
            isJumping = false;
            verticalVelocity = 0;
        }
    } else {
        controls.getObject().position.y = groundHeight + cameraHeightOffset;
    }

    handleTeleport();
    checkLookingAtSphere(); // Check if looking at the sphere
    updateMetrics();

    // Update sphere noise
    if (sphereMaterial) {
        sphereNoiseTime += delta;
        sphereMaterial.uniforms.time.value = sphereNoiseTime;
    }

    renderer.render(scene, camera);
}

// Initial Plane Generation
const initialSpherePosition = new THREE.Vector3(20, 10, 20);
generatePlane(initialSpherePosition);
showWelcomeMessage();
animate();

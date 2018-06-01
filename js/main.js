let faceCount = 0;
let positions = [];

// let loader = new sl.DashLoader('/model/model.mpd');
// loader.start();
const CAMERA_DISTANCE = 500;
// const BOX = {
//     min: new THREE.Vector3(-5.789548873901367,-0.007765999995172024,-6.688999176025391),
//     max: new THREE.Vector3(7.900722026824951,16.59868621826172,4.994770050048828)
// };
//
// const GOTO = {"position":{"x":11.195591074257178,"y":59.78139338546519,"z":-271.07214801621205},"target":{"x":11.457744092218274,"y":59.24109107959679,"z":-270.2725548612594}};

// const GOTO = {"position":{"x":156.2914973953892,"y":34.886338151522004,"z":-15.457383783110426},"target":{"x":155.7498534745208,"y":34.280517994878444,"z":-16.040139135544592}}
// const GOTO = {"position":{"x":-228.10579829818803,"y":58.898004852572484,"z":-115.76845380354398},"target":{"x":-227.16793052120914,"y":58.698555131574814,"z":-115.48451042591633}};
const GOTO = {"position":{"x":156.4909970903973,"y":1.6267812066903506,"z":-146.20626499868177},"target":{"x":157.43106068103407,"y":1.547660317883646,"z":-146.5379581257036}};

const BOX = {
    min: new THREE.Vector3(-14228.7 , -7614.23 , 2584.92),
    max: new THREE.Vector3(-147.666 , 9160.32 , 20710.6)
};

const VIEWPOINT = {"position":{"x":46.41274930339867,"y":18.45933520011096,"z":-90.30955148702074},"target":new THREE.Vector3().copy({"x":46.18160868657803,"y":18.1535182917327,"z":-91.23315856462774})};

const FACTOR = 300/Math.max(BOX.max.x - BOX.min.x, BOX.max.y - BOX.min.y, BOX.max.z - BOX.min.z);

var geometrySize = 0;
var textureSize = 0;
var textureSizes = [];
const maxTextureSize = 161629486;
const maxGeometrySize = 57006477;

var camera, scene, renderer, loader, table, viewpointCamera;
var geometry, material, mesh;
var now = 0, time = 0, controls, controlsElement, stats, model;
var cameraPath, cube;
var boxes = new THREE.Object3D();
boxes.visible = false;
var running = true;

const maxTime = 10;

const initialAngle = Math.random() * 2 * Math.PI;
const initialHeight = 300 * (Math.random() * 2 - 1);

const finalAngle = initialAngle + Math.PI;  // Math.random() * 2 * Math.PI;
const finalHeight = 300 * (Math.random() * 2 - 1);

const SHOW_BOXES = true;
let boxesToPaint = [];

window.paintBoxes = paintBoxes;

function paintBoxes(camera) {
    camera.updateMatrix();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.getInverse(camera.matrixWorld);

    let frustum = new THREE.Frustum();

    frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix, camera.matrixWorldInverse
    ));

    for (let box of boxesToPaint) {
        if (frustum.intersectsBox(box.bounding)) {
            box.material.color.copy(new THREE.Color(0x0000ff));
        }
    }

    let viewpoint = sl.createViewpoint(camera.position, camera.target);
    scene.add(viewpoint);
}

function clearBoxes() {
    for (let box of boxesToPaint) {
        box.material.color.copy(new THREE.Color(0xffffff));
    }
}

function repaintBoxes(camera) {
    camera.updateMatrix();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.getInverse(camera.matrixWorld);

    let frustum = new THREE.Frustum();

    frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix, camera.matrixWorldInverse
    ));

    for (let box of boxesToPaint) {
        if (frustum.intersectsBox(box.bounding)) {
            box.material.color.copy(new THREE.Color(0x0000ff));
        }
    }
}

var timer, hasStartedRecording, recordedPath, recordingInterval, recordNeeded;

function updateStatus() {
    // let status;
    // if (recordingInterval !== undefined) {
    //     status = "recording";
    // } else if (recordNeeded) {
    //     status = "ready to record";
    // } else if (replayingPath) {
    //     status = "replaying";
    // } else if (recordedPath.length !== 0) {
    //     status = "path saved";
    // } else {
    //     status = "idle";
    // }
    // statusSpan.innerHTML = "Status: " + status;
}

function getPositionFromAngle(angle, height) {
    return new THREE.Vector3(
        CAMERA_DISTANCE * Math.cos(angle),
        height,
        CAMERA_DISTANCE * Math.sin(angle)
    );
}

function setCamera(camera, t) {
    camera.position.copy(getPositionFromAngle(
        initialAngle * (1-t) + finalAngle * t,
        initialHeight * (1-t) + finalHeight * t
    ));
    camera.lookAt(new THREE.Vector3());
}


function startRecording() {
    timer = performance.now() + 90000;
    hasStartedRecording = true;
    recordedPath = [];
    recordingInterval = setInterval(logCamera, 100);
    updateStatus();
}

document.addEventListener('keypress', function (e) { if (e.keyCode === 17) { stopRecording(); } });
document.addEventListener('keypress', function (e) { if (e.keyCode === 13) { console.log(JSON.stringify({position: camera.position, target: camera.target})); } });

function stopRecording() {
    clearInterval(recordingInterval);
    recordingInterval = undefined;
    recordNeeded = false;
    updateStatus();
    console.log(JSON.stringify(recordedPath));

}

function logCamera() {
    recordedPath.push({
        time: window.performance.now(),
        position: new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z),
        target: new THREE.Vector3( camera.target.x, camera.target.y, camera.target.z)
    });
}

var started = false;
const FREE_NAVIGATION = true;
const USE_CAMERA_PATH = false;

if (!USE_CAMERA_PATH) {
    init();
    animate();
} else {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', '/js/path.json');
    xhr.onreadystatechange = () => {
        if(xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
            let path = [];
            for (let elt of JSON.parse(xhr.responseText)) {
                path.push({
                    position: new THREE.Vector3().copy(elt.position),
                    target: new THREE.Vector3().copy(elt.target)
                });
            }
            cameraPath = new sl.CameraPath([window.innerWidth, window.innerHeight], path);
            cameraPath.play();
            init();
            animate();
            setTimeout(() => {
                document.body.appendChild(stats.dom);
                started = true;
            }, 5000);
        }

    };
    xhr.send();
}

function init() {

    let reference = new THREE.Object3D();
    if (false) {
        let xAxisGeometry = new THREE.Geometry();
        xAxisGeometry.vertices.push(new THREE.Vector3(0, 0, 0));
        xAxisGeometry.vertices.push(new THREE.Vector3(1000, 0, 0));
        let xAxisMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
            linewidth: 2.0
        });
        let xAxis = new THREE.LineSegments(xAxisGeometry, xAxisMaterial);

        let yAxisGeometry = new THREE.Geometry();
        yAxisGeometry.vertices.push(new THREE.Vector3(0, 0, 0));
        yAxisGeometry.vertices.push(new THREE.Vector3(0, 1000, 0));
        let yAxisMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2.0
        });
        let yAxis = new THREE.LineSegments(yAxisGeometry, yAxisMaterial);

        let zAxisGeometry = new THREE.Geometry();
        zAxisGeometry.vertices.push(new THREE.Vector3(0, 0, 0));
        zAxisGeometry.vertices.push(new THREE.Vector3(0, 0, 1000));
        let zAxisMaterial = new THREE.LineBasicMaterial({
            color: 0x0000ff,
            linewidth: 2.0
        });
        let zAxis = new THREE.LineSegments(zAxisGeometry, zAxisMaterial);

        reference.add(xAxis);
        reference.add(yAxis);
        reference.add(zAxis);
    }

    controlsElement = document.getElementById('controls');
	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 1000);

    camera._innerLookAt = camera.lookAt;
    camera.lookAt = function(target) {
        this.target = target.clone();
        camera._innerLookAt(target);
    }

    camera.position.x = CAMERA_DISTANCE;
    camera.position.y = 300 * (Math.random() * 2 - 1);
    camera.position.z = 0;
    camera.lookAt(new THREE.Vector3());

    window.viewpointCamera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 1000);

    gotoGoto(viewpointCamera, VIEWPOINT);
    stats = new Stats();
    stats.showPanel(0);
    stats.dom.style.right = "0px";
    stats.dom.style.left = "";
    // document.body.appendChild( stats.dom );

	scene = new THREE.Scene();

    var ambient = new THREE.AmbientLight(0x707070);
    scene.add(ambient);

    var directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.x = 300;
    directionalLight.position.y = 300;
    directionalLight.position.z = 300;
    scene.add(directionalLight);

    table = document.getElementById('segments');

    model = new sl.DashBufferModel();
    scene.add(model);
    model.position.set(
        - FACTOR * (BOX.max.x + BOX.min.x) / 2,
        - FACTOR * (BOX.max.y + BOX.min.y) / 2,
        - FACTOR * (BOX.max.z + BOX.min.z) / 2
    );
    model.scale.x = FACTOR;
    model.scale.y = FACTOR;
    model.scale.z = FACTOR;

    camera.position.x = 164.4867179222107;
    camera.position.y = -6.331098624716404;
    camera.position.z = -145.1722345572967;

    document.addEventListener('pointerlockchange', () => {
        if(document.pointerLockElement != undefined) {
            controls.enabled = true;
        } else {
            controls.enabled = false;
        }
    });

    if (USE_CAMERA_PATH && FREE_NAVIGATION) {

        cube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshLambertMaterial({color: 0x00ff00})
        );
        scene.add(cube);
    }

    let loaderCamera = !USE_CAMERA_PATH ? camera : cameraPath.innerCamera;
    let segmentLoader = new sl.BrowserSegmentLoader();

    loader = new sl.GreedyDashLoader(camera, segmentLoader);
    // loader = new sl.GreedyDashLoader(loaderCamera, segmentLoader);
    loader.model = model;
    loader.transform = {
        position: {
            x: - FACTOR * (BOX.max.x + BOX.min.x) / 2,
            y: - FACTOR * (BOX.max.y + BOX.min.y) / 2,
            z: - FACTOR * (BOX.max.z + BOX.min.z) / 2
        },
        scale: FACTOR
    };

    segmentLoader.addEventListener('segmentparsed', (segment, elements) => {

        if (typeof segment.getUrl === 'function' && segment.getUrl().endsWith('.obj')) {
            geometrySize += segment.size;
        } else if (typeof segment.getUrl === 'function' && segment.getUrl().endsWith('.png')) {
            let split = segment.getUrl().split('/');
            let name = split[split.length - 3];
            if (textureSizes[name] !== undefined) {
                textureSize -= textureSizes[name];
            }
            textureSize += segment.size;
            textureSizes[name] = segment.size;
        }

        let Bps = segmentLoader.bandwidthPredictor.getCurrentBandwidth();
        let Kbps = Bps * 8 / 1000;
        document.getElementById('speed').innerHTML = "Received " + (typeof segment.getUrl === 'function' ? segment.getUrl() : segment) + " (" + Math.round(100*Kbps)/100 + 'Kbps)<br/>';

        document.getElementById('speed').innerHTML += "Geometry loaded : " + (Math.floor(10000 * geometrySize / maxGeometrySize) / 100) + "%<br/>";
        document.getElementById('speed').innerHTML += "Texture loaded : " + (Math.floor(10000 * textureSize / maxTextureSize) / 100) + "%<br/>";

        segment.finished = true;

        model.newSegment();

        for (let element of elements) {
            if (element instanceof THREE.Material) {
                model.addMaterial(element);
            } else if (element instanceof sl.Element) {
                element.visit(model);
            } else if (element instanceof THREE.Texture) {
                model.addTexture(element);
            }

        }

    });




    window.bbox = 0;

    // Show the bounding boxes when mpd arrives
    segmentLoader.addEventListener('mpdparsed', (mpd) => {
        // This relies on the fact that the DashLoader.onmpdparsed applies
        // the transform on the boxes of the adaptation sets in the mpd
        mpd.traverse((elt) => {

            let boundingBox = "fullBoundingBox";

            // Do nothing if no bouding box
            if (elt[boundingBox] === undefined) {
                return;
            }

            bbox++;

            if (SHOW_BOXES) {
                // Add bounding box to scene
                let geometry = new THREE.BoxGeometry(
                    elt[boundingBox].max.x - elt[boundingBox].min.x,
                    elt[boundingBox].max.y - elt[boundingBox].min.y,
                    elt[boundingBox].max.z - elt[boundingBox].min.z
                );

                let boundingGeometry = new THREE.Geometry();

                let A = elt[boundingBox].min.clone();
                let G = elt[boundingBox].max.clone();

                let B = A.clone(); B.x = G.x;
                let C = A.clone(); C.x = G.x; C.z = G.z;
                let D = A.clone(); D.z = G.z;


                let E = A.clone(); E.y = G.y;
                let F = E.clone(); F.x = G.x;
                let H = G.clone(); H.x = A.x;

                boundingGeometry.vertices.push(
                    A, B,
                    B, C,
                    D, D,
                    D, A,
                    E, F,
                    F, G,
                    G, H,
                    H, E,
                    E, A,
                    F, B,
                    G, C,
                    H, D
                );

                let material = new THREE.MeshBasicMaterial({
                    color: 0xff0000,
                });

                let material2 = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    opacity: 0.2,
                    transparent: true
                });
                let mesh1 = new THREE.LineSegments(boundingGeometry, material);
                let mesh2 = new THREE.Mesh(geometry, material2);
                mesh1.bounding = elt[boundingBox];
                mesh2.bounding = elt[boundingBox];
                for (let mesh of [mesh2]) {
                    mesh.position.copy(
                        elt[boundingBox].max.clone()
                        .add(elt[boundingBox].min)
                        .multiplyScalar(0.5)
                    );
                }

                boxes.add(mesh1);
                boxes.add(mesh2);
                boxesToPaint.push(mesh2);
            }

        });
    });


    scene.add(boxes);
    scene.add(reference);
    setTimeout(() => {
        loader.load('rust/model.mpd');
    }, 2000);

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );
    // controlsElement.style.height = window.innerHeight + 'px';
	document.body.appendChild( renderer.domElement );
    window.addEventListener('resize', onWindowResize, false);

    enableControls();

    document.addEventListener('keydown', (key) => {
        if (key.keyCode == 17) {
            positions.push({
                position: camera.position,
                target: camera.target,
            });
            console.log(positions);
        }
    });

    gotoGoto(camera, GOTO);
    // document.getElementById('pause').addEventListener('click', function() {
    //     if (running) {
    //         running = false;
    //         this.textContent = "Paused";
    //     } else {
    //         running = true;
    //         now = window.performance.now();
    //         animate();
    //         this.textContent = "Running";
    //     }
    // });

}

function update(v) {
    let total = 0;
    let count = 0;
    // Create a dummy camera corresponding to the frustum
	let tmp = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.005, 5000);
    let frustum = new THREE.Frustum();

    tmp.position.copy(v._position);
    tmp.lookAt(v._target);

    tmp.updateMatrix();
    tmp.updateMatrixWorld(true);
    tmp.matrixWorldInverse.getInverse(tmp.matrixWorld);

    frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(
        tmp.projectionMatrix, tmp.matrixWorldInverse
    ));

    boxes.traverse((box) => {
        if (box instanceof THREE.Mesh) {
            if (frustum.intersectsBox(box.bounding)) {
                box.material.color = new THREE.Color(0, 0, 1);
                count++;
            }
            total++;
        }
    });

    console.log(count + '/' + total, 100 * count / total);
}

function gotoGoto(camera, GOTO) {
    camera.position.copy(GOTO.position);
    camera.target = GOTO.target;
    camera.lookAt(new THREE.Vector3().copy(GOTO.target));
    if (controls !== undefined) {
        controls.anglesFromVectors();
    }
}

function enableControls() {
    if (FREE_NAVIGATION) {
        controls = new sl.PointerLockControls(camera);
        // controls.theta = -1.8831853071824123;
        // controls.phi = -0.14079632679499696;
        controls.anglesFromVectors();
        // controls.vectorsFromAngles();
        controls.speed = 0.0025;
        controls.sensitivity = 0.0025;
        document.addEventListener('click', () => renderer.domElement.requestPointerLock());
        // controls = new THREE.OrbitControls(camera, document);
    }
}

var globPreviousTime = window.performance.now();
var globCurrentTime = window.performance.now();
function animate() {

    if (running) {
        requestAnimationFrame( animate );
    }

    stats.begin();
    var currentTime = window.performance.now();
    time += 0.001 * (currentTime - now);
    now = currentTime;

    // if (controls === undefined)
    //     setCamera(camera, time / maxTime);

    globCurrentTime = window.performance.now();
    let delay = globCurrentTime - globPreviousTime;
    globPreviousTime = window.performance.now();

    if (cube !== undefined) {
        cube.position.copy(cameraPath.innerCamera.position);
        // cube.lookAt(camera.target);
    }

    if (USE_CAMERA_PATH && started) {
        cameraPath.update(delay);
     }

    if (FREE_NAVIGATION) {
        controls.update(delay);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
    } else {
        renderer.render(scene, cameraPath.innerCamera);
    }
    stats.end();

}


function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    if (cameraPath !== undefined) {
        cameraPath.innerCamera.aspect = window.innerWidth / window.innerHeight;
        cameraPath.innerCamera.updateProjectionMatrix();
    }

    renderer.setSize(window.innerWidth, window.innerHeight);
    // controlsElement.style.height = window.innerHeight + 'px';
}

function createViewpointScale(position, target, scale) {

    let ret = new THREE.Object3D();

    position = new THREE.Vector3().copy(position);
    target = new THREE.Vector3().copy(target);

    let direction = target.clone().sub(position);
    let left = direction.clone().cross(new THREE.Vector3(0,1,0));
    let other = direction.clone().cross(left);
    direction.normalize().multiplyScalar(scale);
    left     .normalize().multiplyScalar(scale);
    other    .normalize().multiplyScalar(scale);
    let tmpDirection = direction.clone().multiplyScalar(-2);

    let material = new THREE.MeshBasicMaterial({color: 0x0000ff});
    let geometry = new THREE.Geometry();

    geometry.dynamic = true;

    geometry.vertices.push(
        position.clone().add(left).add(other),
        position.clone().add(other).sub(left),
        position.clone().sub(left).sub(other),
        position.clone().sub(other).add(left),
        position.clone().add(tmpDirection)
    );

    geometry.faces.push(
        new THREE.Face3(0, 1, 2),
        new THREE.Face3(0, 2, 3),
        new THREE.Face3(0, 4, 1),
        new THREE.Face3(1, 4, 2),
        new THREE.Face3(4, 3, 2),
        new THREE.Face3(4, 0, 3)
    );

    let viewpointModel = new THREE.Mesh(geometry, material);
    viewpointModel.visible = true;
    viewpointModel.material.transparent = true;
    viewpointModel.material.opacity = 0.5;

    // Wireframe part of the thing
    let wireframeGeometry = new THREE.Geometry();
    wireframeGeometry.vertices.push(
        position.clone().add(left).add(other),
        position.clone().add(other).sub(left),
        position.clone().sub(left).sub(other),
        position.clone().sub(other).add(left),
        position.clone().add(left).add(other),
        position.clone().sub(other).add(left),

        position.clone().add(tmpDirection),
        position.clone().add(left).add(other),

        position.clone().add(tmpDirection),
        position.clone().add(other).sub(left),

        position.clone().add(tmpDirection),
        position.clone().sub(left).sub(other),

        position.clone().add(tmpDirection),
        position.clone().sub(other).add(left)
    );
    wireframeGeometry.dynamic = true;
    let wireframeMaterial = new THREE.LineBasicMaterial({color: 0xffffff, linewidth:3});

    viewpointModel.add(new THREE.Line(wireframeGeometry, wireframeMaterial));
    viewpointModel.position.copy(direction.clone().multiplyScalar(2));
    viewpointModel._position = position;
    viewpointModel._target = target;
    return viewpointModel;

}

function createViewpoint(position, target) {

    let ret = new THREE.Object3D();

    let m1 = createViewpointScale(position, target, 10);
    // m1.material.opacity = 0.5;
    // let m2 = createViewpointScale(position, target, 200);
    // m2.material.opacity = 0.2;

    // ret.add(m1);
    //ret.add(m2);
    return m1;
}

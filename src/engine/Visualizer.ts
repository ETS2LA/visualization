import * as THREE from 'three';
import type { DataFrame } from '../core/types';
import type { DataProvider } from '../providers/DataProvider';
import { DataFrameInterpolator } from '../core/types';
import { CameraHandler } from './CameraHandler';
import { VehicleRenderer } from './renderers/VehicleRenderer';
import { NodeRenderer } from './renderers/NodeRenderer';
import { DebugTextRenderer } from './renderers/DebugRenderer';

interface VisualizerProps {
    container: HTMLElement;
    backgroundColor?: number;
}

export class Visualizer {
    private interpolator: DataFrameInterpolator;
    private activeProvider: DataProvider | null = null;
    private container: HTMLElement;
    private debugTextContainer: HTMLElement | null = null;
    
    private scene: THREE.Scene;
    private camera: CameraHandler;
    private renderer: THREE.WebGLRenderer;
    private resizeObserver: ResizeObserver;
    
    private debugTextRenderer: DebugTextRenderer;
    private vehicleRenderer: VehicleRenderer;
    private nodeRenderer: NodeRenderer;
    private animationFrameId: number | null = null;
    
    private frameTimer: number = Date.now();

    private truckMesh: THREE.Mesh | null = null;
    
    constructor(props: VisualizerProps) {
        this.container = props.container;
        this.container.innerHTML = '';
        this.debugTextContainer = document.createElement('div');
        this.debugTextContainer.style.position = 'absolute';
        this.debugTextContainer.style.top = '0';
        this.debugTextContainer.style.left = '0';
        this.debugTextContainer.style.color = 'white';
        this.debugTextContainer.style.fontFamily = 'monospace';
        this.debugTextContainer.style.fontSize = '12px';
        this.debugTextContainer.style.padding = '10px';
        this.debugTextContainer.style.display = 'flex';
        this.debugTextContainer.style.gap = '5px';
        this.debugTextContainer.style.flexDirection = 'column';
        this.container.appendChild(this.debugTextContainer);

        this.debugTextRenderer = new DebugTextRenderer(this.debugTextContainer);
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(props.backgroundColor ?? 0x1a1a1a);
        
        this.camera = new CameraHandler(this.container);
        this.interpolator = new DataFrameInterpolator();
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(ambientLight, directionalLight);
        
        // temporary truck, we need a model for this
        const truckGeometry = new THREE.BoxGeometry(2, 1, 4);
        const truckMaterial = new THREE.MeshStandardMaterial({ color: 0x00FF00 });
        this.truckMesh = new THREE.Mesh(truckGeometry, truckMaterial);
        this.truckMesh.position.set(0, -0.5, 0);
        this.scene.add(this.truckMesh);

        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(this.container);
        
        this.vehicleRenderer = new VehicleRenderer();
        this.scene.add(this.vehicleRenderer.group);
        this.nodeRenderer = new NodeRenderer();
        this.scene.add(this.nodeRenderer.group);

        this.loop();
    }
    
    // This is the main loop function, it runs every frame (requestAnimationFrame)
    // at whatever the display refresh rate is. Obviously that might drop if the
    // PC is under load...
    private deltaHistory: number[] = [];
    private loop = () => {
        const delta = Date.now() - this.frameTimer;
        this.frameTimer = Date.now();

        this.deltaHistory.push(delta);
        if (this.deltaHistory.length > 60) {
            this.deltaHistory.shift();
        }

        const avgDelta = this.deltaHistory.reduce((a, b) => a + b, 0) / this.deltaHistory.length;
        const fps = 1000 / avgDelta;

        this.debugTextRenderer.reset();
        this.debugTextRenderer.addString(`FPS: ${fps.toFixed(2)}`);
        this.debugTextRenderer.addString(`Frame Timestamp: ${this.interpolator.currentFrame?.timestamp ?? 'N/A'}`);
        this.debugTextRenderer.addString(`Nodes: ${this.nodeRenderer.group.children.length}`);
        this.debugTextRenderer.addString(`Vehicles: ${this.vehicleRenderer.group.children.length}`);
        
        this.updateState();
        this.camera.update();
        this.renderer.render(this.scene, this.camera.c);
        this.debugTextRenderer.render();
        this.animationFrameId = requestAnimationFrame(this.loop);
    };
    
    public setSource(provider: DataProvider) {
        if (this.activeProvider) {
            this.activeProvider.disconnect();
        }
        
        this.activeProvider = provider;
        this.activeProvider.onFrame((frame) => this.onFrame(frame));
        this.activeProvider.connect();
    }

    private onFrame(frame: DataFrame) {
        frame.timestamp = Date.now();
        this.interpolator.setCurrentFrame(frame);
    }
    
    private updateState() {
        const frame = this.interpolator.getInterpolatedFrame(Date.now());
        if (!frame) return;

        this.truckMesh?.setRotationFromQuaternion(new THREE.Quaternion(
            -frame.telemetryData.rotation.X,
            frame.telemetryData.rotation.Y,
            frame.telemetryData.rotation.Z,
            frame.telemetryData.rotation.W
        ));

        this.camera.setQuaternion(frame.telemetryData.rotation);
        this.vehicleRenderer.center = frame.telemetryData.position;
        this.vehicleRenderer.updateVehicles(frame.vehicles);

        this.nodeRenderer.center = frame.telemetryData.position;
        this.nodeRenderer.updateNodes(frame.nodes ? Object.values(frame.nodes) : []);
    }
    
    private onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        if (width === 0 || height === 0) return;
        
        this.camera.resize(width, height);
        this.renderer.setSize(width, height);
    }
    
    public dispose() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        if (this.activeProvider) {
            this.activeProvider.disconnect();
        }
        
        this.resizeObserver.disconnect();
        this.renderer.dispose();
        this.container.innerHTML = '';
    }
}
import * as THREE from 'three';

export class DebugTextRenderer {
    private stringsToRender: string[] = new Array(0);
    private HTMLEContainer: HTMLElement;

    constructor(container: HTMLElement) {
        this.HTMLEContainer = container;
    }

    public render() {
        this.HTMLEContainer.innerHTML = '';
        for (const str of this.stringsToRender) {
            const p = document.createElement('p');
            p.style.height = 'auto';
            p.textContent = str;
            this.HTMLEContainer.appendChild(p);
        }
    }
    
    public reset() {
        this.stringsToRender = [];
    }

    public addString(str: string) {
        this.stringsToRender.push(str);
    }
}
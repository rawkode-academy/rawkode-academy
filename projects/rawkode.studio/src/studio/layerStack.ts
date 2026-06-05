import type { StudioLayer, StudioScene } from "../types";

export function getLayersById(layers: StudioLayer[]): Map<string, StudioLayer> {
  return new Map(layers.map((layer) => [layer.id, layer]));
}

export function getSceneLayerStack(scene: StudioScene | undefined, layers: StudioLayer[]): StudioLayer[] {
  if (!scene) {
    return [];
  }

  const layersById = getLayersById(layers);
  return scene.layerIds
    .map((id) => layersById.get(id))
    .filter((layer): layer is StudioLayer => Boolean(layer));
}

export function getRenderLayerStack(layers: StudioLayer[]): StudioLayer[] {
  return layers.filter((layer) => layer.enabled && layer.type !== "audio");
}

export function getHitTestLayerStack(layers: StudioLayer[]): StudioLayer[] {
  return [...layers].reverse().filter((layer) => layer.enabled && layer.type !== "audio" && layer.type !== "background");
}

export function getRailLayerStack(layers: StudioLayer[]): StudioLayer[] {
  return [...layers].reverse();
}

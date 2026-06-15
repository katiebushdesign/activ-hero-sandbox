import * as THREE from 'three';

/**
 * Update shader uniforms for object-fit: cover background sampling.
 */
export function getMediaDimensions(texture) {
  const image = texture?.image;
  if (!image) return null;

  const width = image.videoWidth || image.naturalWidth || image.width || 0;
  const height = image.videoHeight || image.naturalHeight || image.height || 0;

  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

export function setBackgroundCoverUniforms(
  uniforms,
  texture,
  viewportWidth,
  viewportHeight,
  { flipX = false } = {}
) {
  if (!texture || viewportWidth <= 0 || viewportHeight <= 0) {
    uniforms.uBackgroundCover.value.set(1, 1, 0, 0);
    return false;
  }

  const media = getMediaDimensions(texture);
  if (!media) {
    uniforms.uBackgroundCover.value.set(1, 1, 0, 0);
    return false;
  }

  const { width: texWidth, height: texHeight } = media;
  const viewportAspect = viewportWidth / viewportHeight;
  const textureAspect = texWidth / texHeight;

  let scaleX = 1;
  let scaleY = 1;

  if (viewportAspect > textureAspect) {
    scaleY = textureAspect / viewportAspect;
  } else {
    scaleX = viewportAspect / textureAspect;
  }

  if (flipX) {
    scaleX = -scaleX;
  }

  uniforms.uBackgroundCover.value.set(scaleX, scaleY, 0, 0);
  return true;
}

export function getTextureSize(texture) {
  const image = texture?.image;
  return new THREE.Vector2(
    image?.videoWidth || image?.width || 1,
    image?.videoHeight || image?.height || 1
  );
}

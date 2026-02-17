import landscapeMetadata from "../../../../assets/images/metadata/landscape_v1.json";
import portraitMetadata from "../../../../assets/images/metadata/portrait_v1.json";
import nightMetadata from "../../../../assets/images/metadata/night_v1.json";

type ImageMetadata = {
  image_id: string;
  title: string;
  description: string;
  sizes: {
    full: {
      path: string;
      pixel_width: number;
      pixel_height: number;
    };
    preview: {
      path: string;
      pixel_width: number;
      pixel_height: number;
    };
  };
};

export type CanonicalImage = {
  id: string;
  title: string;
  description: string;
  previewSrc: string;
  fullSrc: string;
};

const metadataList: ImageMetadata[] = [
  landscapeMetadata as ImageMetadata,
  portraitMetadata as ImageMetadata,
  nightMetadata as ImageMetadata,
];

function toPublicAssetPath(assetPath: string): string {
  if (assetPath.startsWith("assets/")) {
    return `/${assetPath.slice("assets/".length)}`;
  }

  if (assetPath.startsWith("/")) {
    return assetPath;
  }

  return `/${assetPath}`;
}

export const canonicalImages: CanonicalImage[] = metadataList.map((metadata) => ({
  id: metadata.image_id,
  title: metadata.title,
  description: metadata.description,
  previewSrc: toPublicAssetPath(metadata.sizes.preview.path),
  fullSrc: toPublicAssetPath(metadata.sizes.full.path),
}));

export const defaultImageId = canonicalImages[0]?.id ?? "landscape_v1";

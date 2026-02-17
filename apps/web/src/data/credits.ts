import landscapeMetadata from "../../../../assets/images/metadata/landscape_v1.json";
import portraitMetadata from "../../../../assets/images/metadata/portrait_v1.json";
import nightMetadata from "../../../../assets/images/metadata/night_v1.json";
import { lutManifest } from "./luts";

type ImageCreditMetadata = {
  image_id: string;
  title: string;
  author: string;
  license: string;
  license_url: string;
  source_url: string;
  required_attribution: string;
  approval_status: string;
};

export type ImageCredit = {
  id: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  requiredAttribution: string;
  approvalStatus: string;
};

export type LutCredit = {
  id: string;
  source: string;
  family: string;
  licenseName: string;
  licenseUrl: string;
  sourceUrl: string;
  approvalStatus: string;
  notes: string;
};

const imageMetadataList: ImageCreditMetadata[] = [
  landscapeMetadata as ImageCreditMetadata,
  portraitMetadata as ImageCreditMetadata,
  nightMetadata as ImageCreditMetadata,
];

export const imageCredits: ImageCredit[] = imageMetadataList.map((metadata) => ({
  id: metadata.image_id,
  title: metadata.title,
  author: metadata.author,
  license: metadata.license,
  licenseUrl: metadata.license_url,
  sourceUrl: metadata.source_url,
  requiredAttribution: metadata.required_attribution,
  approvalStatus: metadata.approval_status,
}));

export const lutCredits: LutCredit[] = lutManifest.luts.map((entry) => ({
  id: entry.lut_id,
  source: entry.source,
  family: entry.family,
  licenseName: entry.license_name,
  licenseUrl: entry.license_url,
  sourceUrl: entry.source_url,
  approvalStatus: entry.approval_status,
  notes: entry.notes,
}));

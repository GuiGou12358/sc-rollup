export type version = string;

export interface BumpVersion {
  bumpVersion(version: version) : version;
}
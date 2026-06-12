export interface DwSearchPageMeta {
  currentPage: number;
  totalItems: number;
  totalPages: number;
  itemsPerPage: number;
}

export interface DwSearchResult {
  juristicId: string;
  typeCode: string;
  name: string;
  nameEn: string | null;
  status: { code: string; description: string };
  provinceCode: string;
}

export interface DwSearchPage {
  meta: DwSearchPageMeta;
  contents: DwSearchResult[];
}

export interface SearchOptions {
  page?: number;
  type?: string;
  sortBy?: string;
  pvCodeList?: string[];
  jpStatusList?: string[];
}

export interface DwLocationPart {
  /** Province/district/subdistrict code per Thailand's administrative codes. */
  code: string;
  /** Thai name. */
  nameTh: string;
  /** English name. */
  nameEn: string;
}

export interface DwProfileDetail {
  juristicId: string;
  typeCode: string;
  name: string;
  nameEn: string | null;
  status: { code: string; descTh: string; descEn: string | null };
  registrationDate: string | null;  // ISO YYYY-MM-DD
  dissolutionDate: string | null;   // ISO YYYY-MM-DD, null if still active
  /** House number + soi + road if present, in Thai. */
  addressTh: string | null;
  /** Same in English. */
  addressEn: string | null;
  province: DwLocationPart | null;
  district: DwLocationPart | null;     // อำเภอ / amphoe
  subdistrict: DwLocationPart | null;  // ตำบล / tambon
  zipCode: string | null;
  /** Contact details where the registry carries them. */
  phone: string | null;
  email: string | null;
  /** Non-empty registry website entries (upstream webSite1..webSite4). */
  websites: string[];
  businessSizeCode: string | null;
  businessTypeCode: string | null;
  businessTypeDesc: string | null;
  businessTypeDescE: string | null;
}

export interface DwObjective {
  /** TSIC or ISIC code if returned. */
  code: string | null;
  description: string;
}

export interface DwCommittee {
  cmtTypeCode: string | null;
  cmtSeq: number | null;
  firstName: string;
  firstNameE: string | null;
  middleName: string | null;
  middleNameE: string | null;
  lastName: string;
  lastNameE: string | null;
  titleName: string | null;
  titleNameE: string | null;
  titleCode: string | null;
  ntCode: string | null;
  fullName: string;
}

export interface PamSystem {
  id: string
  name: string
  /** 5'->3' recognition pattern; only 'N' (wildcard) and literal bases are needed for v1. */
  pamPattern: string
  /**
   * Which side of the protospacer the PAM sits on. Fixed at '3prime' for every system wired
   * up in v1 (SpCas9). NOT a free parameter in findCandidateGuides — see the callout below.
   */
  pamSide: '3prime'
  guideLength: number
  /** nt from the PAM-proximal edge of the protospacer to the predicted blunt cut site. */
  cutOffsetFromPAM: number
}

// Cas9-family systems (SpCas9, SaCas9) have their PAM 3' of the protospacer. Cas12a/Cpf1
// has its PAM (TTTV) 5' of the protospacer and makes a staggered, not blunt, cut — a second
// scanning algorithm, not a config toggle. `pamSide` exists so a future findCandidateGuides
// refactor has a name for the branch it doesn't have yet; v1 hardcodes the 3' NGG scan.
export const SPCAS9: PamSystem = {
  id: 'spCas9',
  name: 'SpCas9',
  pamPattern: 'NGG',
  pamSide: '3prime',
  guideLength: 20,
  cutOffsetFromPAM: 3,
}

export const PAM_SYSTEMS: PamSystem[] = [SPCAS9]

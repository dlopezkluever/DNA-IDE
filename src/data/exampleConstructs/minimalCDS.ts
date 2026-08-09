export const MINIMAL_CDS_GENBANK = `LOCUS       MINIMAL_CDS               152 bp    DNA     linear   SYN 09-AUG-2026
DEFINITION  Minimal synthetic construct demonstrating promoter, CDS, and terminator.
FEATURES             Location/Qualifiers
     promoter        1..56
                     /label="minimal promoter"
                     /note="synthetic -35/-10 consensus-style promoter"
     RBS             57..70
                     /label="RBS"
     CDS             71..94
                     /gene="miniORF"
                     /product="synthetic minimal peptide"
     terminator      95..152
                     /label="minimal terminator"
                     /note="synthetic rho-independent-style terminator"
ORIGIN
       1 ttgacaatta atcatccggc tcgtataatg tgtggaattg tgagcggata acaattagga
      61 ggaaaaacat atggctaaag aatttggttg gtaacccgca aaaaacccct caagacccgt
     121 ttagaggccc caaggggtta tgctagggcg gg
//
`

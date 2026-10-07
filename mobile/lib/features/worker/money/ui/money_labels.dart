import '../../../../core/l10n/l10n.dart';
import '../../../../core/widgets/common.dart';
import '../money_data.dart';

String regulatorLabel(AppLocalizations l, PartnerRef p) {
  final local = switch (p.regulator) {
    'nrb' => l.regNrb,
    'beema_samiti' => l.regBeema,
    'dofe' => l.regDofe,
    'ctevt' => l.regCtevt,
    _ => '',
  };
  if (local.isNotEmpty) return local;
  return p.regulatorLabel ?? '';
}

/// "Offered by X, regulated by NRB" (or just "Offered by X").
String offeredBy(AppLocalizations l, PartnerRef p) {
  final reg = regulatorLabel(l, p);
  return reg.isEmpty ? l.offerBy(p.name) : l.offerByRegulated(p.name, reg);
}

String offerKindLabel(AppLocalizations l, String kind) => switch (kind) {
  'ewa' => l.offerKindEwa,
  'insurance' => l.offerKindInsurance,
  'savings' => l.offerKindSavings,
  'tool_finance' => l.offerKindTool,
  'vehicle_finance' => l.offerKindVehicle,
  _ => l.offerKindLoan,
};

String partnerKindLabel(AppLocalizations l, String? kind) => switch (kind) {
  'bank' => l.partnerKindBank,
  'microfinance' => l.partnerKindMicrofinance,
  'insurer' => l.partnerKindInsurer,
  'wallet' => l.partnerKindWallet,
  'training' => l.partnerKindTraining,
  'recruitment_agency' => l.partnerKindAgency,
  'government' => l.partnerKindGovernment,
  _ => '',
};

String grantPurposeLabel(AppLocalizations l, String purpose) => switch (purpose) {
  'insurance' => l.consentPurposeInsurance,
  'ewa' => l.consentPurposeEwa,
  'loan_assessment' => l.consentPurposeLoan,
  'recruitment' => l.sharePurposeAgency,
  'training' => l.trainTitle,
  'verification' => l.viewCtxOps,
  _ => purpose,
};

/// Plain-language sentence for a data scope (consent screen).
String scopeLabel(AppLocalizations l, String scope) => switch (scope) {
  'earnings.read' => l.scopeEarnings,
  'profile.read' => l.scopeProfile,
  'passport.read' => l.scopePassport,
  'referrals.write' => l.scopeReferrals,
  _ => scope,
};

String scopeShortLabel(AppLocalizations l, String? scope) => switch (scope) {
  'earnings.read' => l.scopeShortEarnings,
  'profile.read' => l.scopeShortProfile,
  'passport.read' => l.scopeShortPassport,
  'referrals.write' => l.scopeShortReferrals,
  _ => scope ?? '',
};

(String, Tone) financeReferralStatus(AppLocalizations l, String s) => switch (s) {
  'under_review' => (l.refStatusReview, Tone.info),
  'approved' => (l.refStatusApproved, Tone.success),
  'rejected' => (l.refStatusRejected, Tone.danger),
  'disbursed' => (l.refStatusDisbursed, Tone.success),
  'closed' => (l.refStatusClosed, Tone.neutral),
  _ => (l.refStatusSubmitted, Tone.warning),
};

String stabilityLabel(AppLocalizations l, double v) =>
    v >= 0.8
        ? l.finStabilityHigh
        : v >= 0.5
        ? l.finStabilityMedium
        : l.finStabilityLow;

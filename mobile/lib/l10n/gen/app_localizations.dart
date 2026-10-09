import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ne.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'gen/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale) : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[Locale('en'), Locale('ne')];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi'**
  String get appName;

  /// No description provided for @appTagline.
  ///
  /// In en, this message translates to:
  /// **'Verified workers. On-time pay.'**
  String get appTagline;

  /// No description provided for @navDashboard.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get navDashboard;

  /// No description provided for @navJobs.
  ///
  /// In en, this message translates to:
  /// **'Job openings'**
  String get navJobs;

  /// No description provided for @navCandidates.
  ///
  /// In en, this message translates to:
  /// **'Candidates'**
  String get navCandidates;

  /// No description provided for @navWorkers.
  ///
  /// In en, this message translates to:
  /// **'Workers'**
  String get navWorkers;

  /// No description provided for @navAttendance.
  ///
  /// In en, this message translates to:
  /// **'Hajiri (Attendance)'**
  String get navAttendance;

  /// No description provided for @navPayroll.
  ///
  /// In en, this message translates to:
  /// **'Payroll (Talab)'**
  String get navPayroll;

  /// No description provided for @navWageSheet.
  ///
  /// In en, this message translates to:
  /// **'Wage sheet'**
  String get navWageSheet;

  /// No description provided for @navPayslip.
  ///
  /// In en, this message translates to:
  /// **'Payslip'**
  String get navPayslip;

  /// No description provided for @navLeave.
  ///
  /// In en, this message translates to:
  /// **'Leave (Bida)'**
  String get navLeave;

  /// No description provided for @navAdvance.
  ///
  /// In en, this message translates to:
  /// **'Advance (Peski)'**
  String get navAdvance;

  /// No description provided for @navSites.
  ///
  /// In en, this message translates to:
  /// **'Work sites'**
  String get navSites;

  /// No description provided for @navSettings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get navSettings;

  /// No description provided for @navBilling.
  ///
  /// In en, this message translates to:
  /// **'Billing'**
  String get navBilling;

  /// No description provided for @termBasicSalary.
  ///
  /// In en, this message translates to:
  /// **'Basic salary'**
  String get termBasicSalary;

  /// No description provided for @termDearnessAllowance.
  ///
  /// In en, this message translates to:
  /// **'Dearness allowance (DA)'**
  String get termDearnessAllowance;

  /// No description provided for @termDailyWage.
  ///
  /// In en, this message translates to:
  /// **'Daily wage (Jyala)'**
  String get termDailyWage;

  /// No description provided for @termMonthlySalary.
  ///
  /// In en, this message translates to:
  /// **'Monthly salary'**
  String get termMonthlySalary;

  /// No description provided for @termOvertime.
  ///
  /// In en, this message translates to:
  /// **'Overtime (OT)'**
  String get termOvertime;

  /// No description provided for @termAllowance.
  ///
  /// In en, this message translates to:
  /// **'Allowance (Bhatta)'**
  String get termAllowance;

  /// No description provided for @termFestivalAllowance.
  ///
  /// In en, this message translates to:
  /// **'Dashain allowance'**
  String get termFestivalAllowance;

  /// No description provided for @termSsf.
  ///
  /// In en, this message translates to:
  /// **'SSF (Social Security Fund)'**
  String get termSsf;

  /// No description provided for @termSsfNo.
  ///
  /// In en, this message translates to:
  /// **'SSF ID'**
  String get termSsfNo;

  /// No description provided for @termPan.
  ///
  /// In en, this message translates to:
  /// **'PAN'**
  String get termPan;

  /// No description provided for @termCitizenship.
  ///
  /// In en, this message translates to:
  /// **'Citizenship no.'**
  String get termCitizenship;

  /// No description provided for @termNid.
  ///
  /// In en, this message translates to:
  /// **'National ID (NID)'**
  String get termNid;

  /// No description provided for @termNaike.
  ///
  /// In en, this message translates to:
  /// **'Team lead (Naike)'**
  String get termNaike;

  /// No description provided for @termSupervisor.
  ///
  /// In en, this message translates to:
  /// **'Supervisor'**
  String get termSupervisor;

  /// No description provided for @termShift.
  ///
  /// In en, this message translates to:
  /// **'Shift'**
  String get termShift;

  /// No description provided for @termPresent.
  ///
  /// In en, this message translates to:
  /// **'Present'**
  String get termPresent;

  /// No description provided for @termAbsent.
  ///
  /// In en, this message translates to:
  /// **'Absent'**
  String get termAbsent;

  /// No description provided for @termHalfDay.
  ///
  /// In en, this message translates to:
  /// **'Half day'**
  String get termHalfDay;

  /// No description provided for @termOnLeave.
  ///
  /// In en, this message translates to:
  /// **'On leave'**
  String get termOnLeave;

  /// No description provided for @termPublicHoliday.
  ///
  /// In en, this message translates to:
  /// **'Public holiday'**
  String get termPublicHoliday;

  /// No description provided for @termCheckIn.
  ///
  /// In en, this message translates to:
  /// **'Check in'**
  String get termCheckIn;

  /// No description provided for @termCheckOut.
  ///
  /// In en, this message translates to:
  /// **'Check out'**
  String get termCheckOut;

  /// No description provided for @termVerified.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get termVerified;

  /// No description provided for @termSkillCertificate.
  ///
  /// In en, this message translates to:
  /// **'Skill certificate (NSTB)'**
  String get termSkillCertificate;

  /// No description provided for @termExperience.
  ///
  /// In en, this message translates to:
  /// **'Experience'**
  String get termExperience;

  /// No description provided for @termProvince.
  ///
  /// In en, this message translates to:
  /// **'Province'**
  String get termProvince;

  /// No description provided for @termDistrict.
  ///
  /// In en, this message translates to:
  /// **'District'**
  String get termDistrict;

  /// No description provided for @termMunicipality.
  ///
  /// In en, this message translates to:
  /// **'Municipality'**
  String get termMunicipality;

  /// No description provided for @termWard.
  ///
  /// In en, this message translates to:
  /// **'Ward'**
  String get termWard;

  /// No description provided for @termNpr.
  ///
  /// In en, this message translates to:
  /// **'Rs.'**
  String get termNpr;

  /// No description provided for @termBs.
  ///
  /// In en, this message translates to:
  /// **'B.S.'**
  String get termBs;

  /// No description provided for @termAd.
  ///
  /// In en, this message translates to:
  /// **'A.D.'**
  String get termAd;

  /// No description provided for @termFiscalYear.
  ///
  /// In en, this message translates to:
  /// **'Fiscal year'**
  String get termFiscalYear;

  /// No description provided for @statusDraft.
  ///
  /// In en, this message translates to:
  /// **'Draft'**
  String get statusDraft;

  /// No description provided for @statusOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get statusOpen;

  /// No description provided for @statusFilled.
  ///
  /// In en, this message translates to:
  /// **'Filled'**
  String get statusFilled;

  /// No description provided for @statusClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get statusClosed;

  /// No description provided for @stageSourced.
  ///
  /// In en, this message translates to:
  /// **'Sourced'**
  String get stageSourced;

  /// No description provided for @stageShortlisted.
  ///
  /// In en, this message translates to:
  /// **'Shortlisted'**
  String get stageShortlisted;

  /// No description provided for @stageInterview.
  ///
  /// In en, this message translates to:
  /// **'Interview'**
  String get stageInterview;

  /// No description provided for @stageSelected.
  ///
  /// In en, this message translates to:
  /// **'Selected'**
  String get stageSelected;

  /// No description provided for @stageJoined.
  ///
  /// In en, this message translates to:
  /// **'Joined'**
  String get stageJoined;

  /// No description provided for @stageRejected.
  ///
  /// In en, this message translates to:
  /// **'Not selected'**
  String get stageRejected;

  /// No description provided for @stageDropped.
  ///
  /// In en, this message translates to:
  /// **'Dropped out'**
  String get stageDropped;

  /// No description provided for @payrollDraft.
  ///
  /// In en, this message translates to:
  /// **'Draft'**
  String get payrollDraft;

  /// No description provided for @payrollApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get payrollApproved;

  /// No description provided for @payrollPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get payrollPaid;

  /// No description provided for @payEsewa.
  ///
  /// In en, this message translates to:
  /// **'eSewa'**
  String get payEsewa;

  /// No description provided for @payKhalti.
  ///
  /// In en, this message translates to:
  /// **'Khalti'**
  String get payKhalti;

  /// No description provided for @payBank.
  ///
  /// In en, this message translates to:
  /// **'Bank transfer'**
  String get payBank;

  /// No description provided for @payCash.
  ///
  /// In en, this message translates to:
  /// **'Cash'**
  String get payCash;

  /// No description provided for @termWeeklyOff.
  ///
  /// In en, this message translates to:
  /// **'Weekly off'**
  String get termWeeklyOff;

  /// No description provided for @termNotMarked.
  ///
  /// In en, this message translates to:
  /// **'Not marked'**
  String get termNotMarked;

  /// No description provided for @statusShortPresent.
  ///
  /// In en, this message translates to:
  /// **'P'**
  String get statusShortPresent;

  /// No description provided for @statusShortAbsent.
  ///
  /// In en, this message translates to:
  /// **'A'**
  String get statusShortAbsent;

  /// No description provided for @statusShortHalfDay.
  ///
  /// In en, this message translates to:
  /// **'H'**
  String get statusShortHalfDay;

  /// No description provided for @statusShortLeave.
  ///
  /// In en, this message translates to:
  /// **'L'**
  String get statusShortLeave;

  /// No description provided for @statusShortHoliday.
  ///
  /// In en, this message translates to:
  /// **'PH'**
  String get statusShortHoliday;

  /// No description provided for @statusShortWeeklyOff.
  ///
  /// In en, this message translates to:
  /// **'WO'**
  String get statusShortWeeklyOff;

  /// No description provided for @commonRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get commonRetry;

  /// No description provided for @commonCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get commonCancel;

  /// No description provided for @commonSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get commonSave;

  /// No description provided for @commonSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get commonSaved;

  /// No description provided for @commonContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get commonContinue;

  /// No description provided for @commonClose.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get commonClose;

  /// No description provided for @commonConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get commonConfirm;

  /// No description provided for @commonToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get commonToday;

  /// No description provided for @commonYesterday.
  ///
  /// In en, this message translates to:
  /// **'Yesterday'**
  String get commonYesterday;

  /// No description provided for @commonErrorGeneric.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get commonErrorGeneric;

  /// No description provided for @commonOffline.
  ///
  /// In en, this message translates to:
  /// **'You\'re offline. Changes will sync when you\'re back online.'**
  String get commonOffline;

  /// No description provided for @commonNetworkError.
  ///
  /// In en, this message translates to:
  /// **'No internet connection. Please check and try again.'**
  String get commonNetworkError;

  /// No description provided for @commonSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session has ended. Please log in again.'**
  String get commonSessionExpired;

  /// No description provided for @commonPermissionDenied.
  ///
  /// In en, this message translates to:
  /// **'You don\'t have permission to do this.'**
  String get commonPermissionDenied;

  /// No description provided for @commonNotFound.
  ///
  /// In en, this message translates to:
  /// **'Not found.'**
  String get commonNotFound;

  /// No description provided for @commonEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing here yet.'**
  String get commonEmpty;

  /// No description provided for @commonPreviousMonth.
  ///
  /// In en, this message translates to:
  /// **'Previous month'**
  String get commonPreviousMonth;

  /// No description provided for @commonNextMonth.
  ///
  /// In en, this message translates to:
  /// **'Next month'**
  String get commonNextMonth;

  /// No description provided for @commonTotal.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get commonTotal;

  /// No description provided for @commonDays.
  ///
  /// In en, this message translates to:
  /// **'Days'**
  String get commonDays;

  /// No description provided for @commonNow.
  ///
  /// In en, this message translates to:
  /// **'Now'**
  String get commonNow;

  /// No description provided for @languageTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose your language'**
  String get languageTitle;

  /// No description provided for @languageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You can change this later in your profile.'**
  String get languageSubtitle;

  /// No description provided for @languageEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @languageNepali.
  ///
  /// In en, this message translates to:
  /// **'नेपाली'**
  String get languageNepali;

  /// No description provided for @languageLabel.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get languageLabel;

  /// No description provided for @loginTitle.
  ///
  /// In en, this message translates to:
  /// **'Log in with your mobile number'**
  String get loginTitle;

  /// No description provided for @loginSubtitle.
  ///
  /// In en, this message translates to:
  /// **'We\'ll send a 6-digit code by SMS.'**
  String get loginSubtitle;

  /// No description provided for @loginPhoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get loginPhoneLabel;

  /// No description provided for @loginPhoneHint.
  ///
  /// In en, this message translates to:
  /// **'98XXXXXXXX'**
  String get loginPhoneHint;

  /// No description provided for @loginPhoneInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a 10-digit mobile number starting with 97 or 98.'**
  String get loginPhoneInvalid;

  /// No description provided for @loginSendCode.
  ///
  /// In en, this message translates to:
  /// **'Send code'**
  String get loginSendCode;

  /// No description provided for @otpTitle.
  ///
  /// In en, this message translates to:
  /// **'Enter the code'**
  String get otpTitle;

  /// No description provided for @otpSubtitle.
  ///
  /// In en, this message translates to:
  /// **'We sent a 6-digit code to {phone}'**
  String otpSubtitle(String phone);

  /// No description provided for @otpVerify.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get otpVerify;

  /// No description provided for @otpResend.
  ///
  /// In en, this message translates to:
  /// **'Resend code'**
  String get otpResend;

  /// No description provided for @otpResendIn.
  ///
  /// In en, this message translates to:
  /// **'Resend code in {seconds}s'**
  String otpResendIn(String seconds);

  /// No description provided for @otpDevHint.
  ///
  /// In en, this message translates to:
  /// **'Development code: {code}'**
  String otpDevHint(String code);

  /// No description provided for @otpChangeNumber.
  ///
  /// In en, this message translates to:
  /// **'Change number'**
  String get otpChangeNumber;

  /// No description provided for @otpSent.
  ///
  /// In en, this message translates to:
  /// **'A new code has been sent.'**
  String get otpSent;

  /// No description provided for @otpIncomplete.
  ///
  /// In en, this message translates to:
  /// **'Enter all 6 digits.'**
  String get otpIncomplete;

  /// No description provided for @errOtpInvalid.
  ///
  /// In en, this message translates to:
  /// **'That code is not correct. Please check and try again.'**
  String get errOtpInvalid;

  /// No description provided for @errOtpExpired.
  ///
  /// In en, this message translates to:
  /// **'This code has expired. Please request a new one.'**
  String get errOtpExpired;

  /// No description provided for @errOtpRateLimited.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please wait a while and try again.'**
  String get errOtpRateLimited;

  /// No description provided for @noAccessTitle.
  ///
  /// In en, this message translates to:
  /// **'Ask your employer to add you'**
  String get noAccessTitle;

  /// No description provided for @noAccessBody.
  ///
  /// In en, this message translates to:
  /// **'Your number {phone} is not linked to any employer yet. Ask your employer or supervisor to add you on KaamSathi with this number, then tap “Check again”.'**
  String noAccessBody(String phone);

  /// No description provided for @noAccessRetry.
  ///
  /// In en, this message translates to:
  /// **'Check again'**
  String get noAccessRetry;

  /// No description provided for @noAccessStill.
  ///
  /// In en, this message translates to:
  /// **'Still not linked. Please check with your employer.'**
  String get noAccessStill;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get logout;

  /// No description provided for @logoutConfirm.
  ///
  /// In en, this message translates to:
  /// **'Log out of KaamSathi?'**
  String get logoutConfirm;

  /// No description provided for @logoutPendingWarning.
  ///
  /// In en, this message translates to:
  /// **'{count} hajiri changes are not synced yet. They will be lost if you log out now.'**
  String logoutPendingWarning(String count);

  /// No description provided for @orgPickTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose organization'**
  String get orgPickTitle;

  /// No description provided for @sitePickTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose work site'**
  String get sitePickTitle;

  /// No description provided for @allSites.
  ///
  /// In en, this message translates to:
  /// **'All my sites'**
  String get allSites;

  /// No description provided for @organization.
  ///
  /// In en, this message translates to:
  /// **'Organization'**
  String get organization;

  /// No description provided for @workSite.
  ///
  /// In en, this message translates to:
  /// **'Work site'**
  String get workSite;

  /// No description provided for @modeSupervisor.
  ///
  /// In en, this message translates to:
  /// **'Supervisor'**
  String get modeSupervisor;

  /// No description provided for @modeWorker.
  ///
  /// In en, this message translates to:
  /// **'Worker'**
  String get modeWorker;

  /// No description provided for @modeSwitchToWorker.
  ///
  /// In en, this message translates to:
  /// **'Switch to my worker view'**
  String get modeSwitchToWorker;

  /// No description provided for @modeSwitchToSupervisor.
  ///
  /// In en, this message translates to:
  /// **'Switch to supervisor view'**
  String get modeSwitchToSupervisor;

  /// No description provided for @moreTitle.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get moreTitle;

  /// No description provided for @roleOwner.
  ///
  /// In en, this message translates to:
  /// **'Owner'**
  String get roleOwner;

  /// No description provided for @roleAdmin.
  ///
  /// In en, this message translates to:
  /// **'Admin'**
  String get roleAdmin;

  /// No description provided for @roleHr.
  ///
  /// In en, this message translates to:
  /// **'HR'**
  String get roleHr;

  /// No description provided for @roleSupervisor.
  ///
  /// In en, this message translates to:
  /// **'Supervisor'**
  String get roleSupervisor;

  /// No description provided for @hajiriMarkAllPresent.
  ///
  /// In en, this message translates to:
  /// **'Mark all present'**
  String get hajiriMarkAllPresent;

  /// No description provided for @hajiriMarkAllConfirm.
  ///
  /// In en, this message translates to:
  /// **'Mark {count} unmarked workers as present?'**
  String hajiriMarkAllConfirm(String count);

  /// No description provided for @hajiriAllMarked.
  ///
  /// In en, this message translates to:
  /// **'Everyone is already marked.'**
  String get hajiriAllMarked;

  /// No description provided for @hajiriPendingSync.
  ///
  /// In en, this message translates to:
  /// **'{count} waiting to sync'**
  String hajiriPendingSync(String count);

  /// No description provided for @hajiriAllSynced.
  ///
  /// In en, this message translates to:
  /// **'All changes saved'**
  String get hajiriAllSynced;

  /// No description provided for @hajiriSyncNow.
  ///
  /// In en, this message translates to:
  /// **'Sync now'**
  String get hajiriSyncNow;

  /// No description provided for @hajiriSyncing.
  ///
  /// In en, this message translates to:
  /// **'Syncing…'**
  String get hajiriSyncing;

  /// No description provided for @hajiriSyncFailed.
  ///
  /// In en, this message translates to:
  /// **'{count} could not be saved'**
  String hajiriSyncFailed(String count);

  /// No description provided for @hajiriOfflineCached.
  ///
  /// In en, this message translates to:
  /// **'Offline — showing the last saved list.'**
  String get hajiriOfflineCached;

  /// No description provided for @hajiriNoWorkers.
  ///
  /// In en, this message translates to:
  /// **'No workers at this site yet.'**
  String get hajiriNoWorkers;

  /// No description provided for @hajiriHoliday.
  ///
  /// In en, this message translates to:
  /// **'Public holiday: {name}'**
  String hajiriHoliday(String name);

  /// No description provided for @hajiriOvertime.
  ///
  /// In en, this message translates to:
  /// **'OT {hours} h'**
  String hajiriOvertime(String hours);

  /// No description provided for @hajiriOtDecrease.
  ///
  /// In en, this message translates to:
  /// **'Decrease overtime'**
  String get hajiriOtDecrease;

  /// No description provided for @hajiriOtIncrease.
  ///
  /// In en, this message translates to:
  /// **'Increase overtime'**
  String get hajiriOtIncrease;

  /// No description provided for @hajiriRegister.
  ///
  /// In en, this message translates to:
  /// **'Monthly register'**
  String get hajiriRegister;

  /// No description provided for @hajiriPickDate.
  ///
  /// In en, this message translates to:
  /// **'Choose date'**
  String get hajiriPickDate;

  /// No description provided for @hajiriDiscard.
  ///
  /// In en, this message translates to:
  /// **'Discard'**
  String get hajiriDiscard;

  /// No description provided for @hajiriRetrySync.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get hajiriRetrySync;

  /// No description provided for @hajiriNotSynced.
  ///
  /// In en, this message translates to:
  /// **'Not synced yet'**
  String get hajiriNotSynced;

  /// No description provided for @hajiriSearch.
  ///
  /// In en, this message translates to:
  /// **'Search worker'**
  String get hajiriSearch;

  /// No description provided for @hajiriCount.
  ///
  /// In en, this message translates to:
  /// **'{count} workers'**
  String hajiriCount(String count);

  /// No description provided for @registerEmpty.
  ///
  /// In en, this message translates to:
  /// **'No hajiri for this month.'**
  String get registerEmpty;

  /// No description provided for @registerOtHours.
  ///
  /// In en, this message translates to:
  /// **'OT hours'**
  String get registerOtHours;

  /// No description provided for @leavePending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get leavePending;

  /// No description provided for @leaveApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get leaveApproved;

  /// No description provided for @leaveRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get leaveRejected;

  /// No description provided for @leaveApprove.
  ///
  /// In en, this message translates to:
  /// **'Approve'**
  String get leaveApprove;

  /// No description provided for @leaveReject.
  ///
  /// In en, this message translates to:
  /// **'Reject'**
  String get leaveReject;

  /// No description provided for @leaveRejectTitle.
  ///
  /// In en, this message translates to:
  /// **'Reject leave request?'**
  String get leaveRejectTitle;

  /// No description provided for @leaveRejectNote.
  ///
  /// In en, this message translates to:
  /// **'Reason (optional)'**
  String get leaveRejectNote;

  /// No description provided for @leaveDays.
  ///
  /// In en, this message translates to:
  /// **'{days} days'**
  String leaveDays(String days);

  /// No description provided for @leaveEmpty.
  ///
  /// In en, this message translates to:
  /// **'No leave requests here.'**
  String get leaveEmpty;

  /// No description provided for @leaveApprovedMsg.
  ///
  /// In en, this message translates to:
  /// **'Leave approved.'**
  String get leaveApprovedMsg;

  /// No description provided for @leaveRejectedMsg.
  ///
  /// In en, this message translates to:
  /// **'Leave rejected.'**
  String get leaveRejectedMsg;

  /// No description provided for @leaveTypeHome.
  ///
  /// In en, this message translates to:
  /// **'Home leave'**
  String get leaveTypeHome;

  /// No description provided for @leaveTypeSick.
  ///
  /// In en, this message translates to:
  /// **'Sick leave'**
  String get leaveTypeSick;

  /// No description provided for @leaveTypeMaternity.
  ///
  /// In en, this message translates to:
  /// **'Maternity leave'**
  String get leaveTypeMaternity;

  /// No description provided for @leaveTypePaternity.
  ///
  /// In en, this message translates to:
  /// **'Paternity leave'**
  String get leaveTypePaternity;

  /// No description provided for @leaveTypeMourning.
  ///
  /// In en, this message translates to:
  /// **'Mourning leave'**
  String get leaveTypeMourning;

  /// No description provided for @leaveTypeUnpaid.
  ///
  /// In en, this message translates to:
  /// **'Unpaid leave'**
  String get leaveTypeUnpaid;

  /// No description provided for @homeGreeting.
  ///
  /// In en, this message translates to:
  /// **'Namaste, {name}'**
  String homeGreeting(String name);

  /// No description provided for @homeTodayHajiri.
  ///
  /// In en, this message translates to:
  /// **'Today\'s hajiri'**
  String get homeTodayHajiri;

  /// No description provided for @homeNotCheckedIn.
  ///
  /// In en, this message translates to:
  /// **'You haven\'t checked in today.'**
  String get homeNotCheckedIn;

  /// No description provided for @homeCheckedInAt.
  ///
  /// In en, this message translates to:
  /// **'Checked in at {time}'**
  String homeCheckedInAt(String time);

  /// No description provided for @homeCheckedOutAt.
  ///
  /// In en, this message translates to:
  /// **'Checked out at {time}'**
  String homeCheckedOutAt(String time);

  /// No description provided for @homeScanHint.
  ///
  /// In en, this message translates to:
  /// **'Scan the QR code at your work site.'**
  String get homeScanHint;

  /// No description provided for @homeThisMonth.
  ///
  /// In en, this message translates to:
  /// **'This month'**
  String get homeThisMonth;

  /// No description provided for @homeLatestPayslip.
  ///
  /// In en, this message translates to:
  /// **'Latest payslip'**
  String get homeLatestPayslip;

  /// No description provided for @checkInSuccess.
  ///
  /// In en, this message translates to:
  /// **'Checked in. Have a good day at work.'**
  String get checkInSuccess;

  /// No description provided for @checkOutSuccess.
  ///
  /// In en, this message translates to:
  /// **'Checked out. See you tomorrow.'**
  String get checkOutSuccess;

  /// No description provided for @scanTitle.
  ///
  /// In en, this message translates to:
  /// **'Scan site QR'**
  String get scanTitle;

  /// No description provided for @scanInstructions.
  ///
  /// In en, this message translates to:
  /// **'Point the camera at the QR code at your site.'**
  String get scanInstructions;

  /// No description provided for @scanTorch.
  ///
  /// In en, this message translates to:
  /// **'Flashlight'**
  String get scanTorch;

  /// No description provided for @gettingLocation.
  ///
  /// In en, this message translates to:
  /// **'Getting your location…'**
  String get gettingLocation;

  /// No description provided for @sendingHajiri.
  ///
  /// In en, this message translates to:
  /// **'Saving your hajiri…'**
  String get sendingHajiri;

  /// No description provided for @errOutsideGeofence.
  ///
  /// In en, this message translates to:
  /// **'You seem to be away from the work site. Move closer to the site and try again.'**
  String get errOutsideGeofence;

  /// No description provided for @errLocationDenied.
  ///
  /// In en, this message translates to:
  /// **'Location permission is needed to check in. Please allow it.'**
  String get errLocationDenied;

  /// No description provided for @errLocationDeniedForever.
  ///
  /// In en, this message translates to:
  /// **'Location is blocked for KaamSathi. Open settings and allow location.'**
  String get errLocationDeniedForever;

  /// No description provided for @errLocationOff.
  ///
  /// In en, this message translates to:
  /// **'Your location (GPS) is off. Turn it on and try again.'**
  String get errLocationOff;

  /// No description provided for @errCameraDenied.
  ///
  /// In en, this message translates to:
  /// **'Camera permission is needed to scan the QR code.'**
  String get errCameraDenied;

  /// No description provided for @errInvalidQr.
  ///
  /// In en, this message translates to:
  /// **'This is not a KaamSathi site QR code.'**
  String get errInvalidQr;

  /// No description provided for @errAlreadyRecorded.
  ///
  /// In en, this message translates to:
  /// **'This has already been recorded.'**
  String get errAlreadyRecorded;

  /// No description provided for @errInvalidState.
  ///
  /// In en, this message translates to:
  /// **'This can\'t be changed now (the month may be locked for payroll).'**
  String get errInvalidState;

  /// No description provided for @openSettings.
  ///
  /// In en, this message translates to:
  /// **'Open settings'**
  String get openSettings;

  /// No description provided for @talabTitle.
  ///
  /// In en, this message translates to:
  /// **'Talab (Payslips)'**
  String get talabTitle;

  /// No description provided for @talabEmpty.
  ///
  /// In en, this message translates to:
  /// **'No payslips yet. They appear here once your employer runs payroll.'**
  String get talabEmpty;

  /// No description provided for @talabNetPay.
  ///
  /// In en, this message translates to:
  /// **'Net pay'**
  String get talabNetPay;

  /// No description provided for @talabGrossPay.
  ///
  /// In en, this message translates to:
  /// **'Gross pay'**
  String get talabGrossPay;

  /// No description provided for @talabEarnings.
  ///
  /// In en, this message translates to:
  /// **'Earnings'**
  String get talabEarnings;

  /// No description provided for @talabDeductions.
  ///
  /// In en, this message translates to:
  /// **'Deductions'**
  String get talabDeductions;

  /// No description provided for @talabSsfEmployee.
  ///
  /// In en, this message translates to:
  /// **'SSF (11%)'**
  String get talabSsfEmployee;

  /// No description provided for @talabTds.
  ///
  /// In en, this message translates to:
  /// **'Tax (TDS)'**
  String get talabTds;

  /// No description provided for @talabPeskiRecovery.
  ///
  /// In en, this message translates to:
  /// **'Peski recovery'**
  String get talabPeskiRecovery;

  /// No description provided for @talabOtherDeductions.
  ///
  /// In en, this message translates to:
  /// **'Other deductions'**
  String get talabOtherDeductions;

  /// No description provided for @talabOpenPdf.
  ///
  /// In en, this message translates to:
  /// **'Open PDF'**
  String get talabOpenPdf;

  /// No description provided for @talabPresentDays.
  ///
  /// In en, this message translates to:
  /// **'Present days'**
  String get talabPresentDays;

  /// No description provided for @talabPayableDays.
  ///
  /// In en, this message translates to:
  /// **'Payable days'**
  String get talabPayableDays;

  /// No description provided for @talabDaysInMonth.
  ///
  /// In en, this message translates to:
  /// **'Days in month'**
  String get talabDaysInMonth;

  /// No description provided for @talabOtHours.
  ///
  /// In en, this message translates to:
  /// **'OT hours'**
  String get talabOtHours;

  /// No description provided for @talabPaidOn.
  ///
  /// In en, this message translates to:
  /// **'Paid on {date}'**
  String talabPaidOn(String date);

  /// No description provided for @talabPaymentPending.
  ///
  /// In en, this message translates to:
  /// **'Payment pending'**
  String get talabPaymentPending;

  /// No description provided for @talabPaymentMethod.
  ///
  /// In en, this message translates to:
  /// **'Paid by'**
  String get talabPaymentMethod;

  /// No description provided for @talabAttendance.
  ///
  /// In en, this message translates to:
  /// **'Attendance'**
  String get talabAttendance;

  /// No description provided for @talabPdfError.
  ///
  /// In en, this message translates to:
  /// **'Could not open the PDF. Please try again.'**
  String get talabPdfError;

  /// No description provided for @historyTitle.
  ///
  /// In en, this message translates to:
  /// **'Work history'**
  String get historyTitle;

  /// No description provided for @historyEmpty.
  ///
  /// In en, this message translates to:
  /// **'No verified work history yet.'**
  String get historyEmpty;

  /// No description provided for @historyMonths.
  ///
  /// In en, this message translates to:
  /// **'{months} months'**
  String historyMonths(String months);

  /// No description provided for @profileTitle.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profileTitle;

  /// No description provided for @profilePersonal.
  ///
  /// In en, this message translates to:
  /// **'Personal details'**
  String get profilePersonal;

  /// No description provided for @profileName.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get profileName;

  /// No description provided for @profileNameNe.
  ///
  /// In en, this message translates to:
  /// **'Name in Nepali'**
  String get profileNameNe;

  /// No description provided for @profilePhone.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get profilePhone;

  /// No description provided for @profilePaymentMethod.
  ///
  /// In en, this message translates to:
  /// **'How you get paid'**
  String get profilePaymentMethod;

  /// No description provided for @profileBankName.
  ///
  /// In en, this message translates to:
  /// **'Bank name'**
  String get profileBankName;

  /// No description provided for @profileAccountNo.
  ///
  /// In en, this message translates to:
  /// **'Account number'**
  String get profileAccountNo;

  /// No description provided for @profileAccountName.
  ///
  /// In en, this message translates to:
  /// **'Account holder name'**
  String get profileAccountName;

  /// No description provided for @profileWalletId.
  ///
  /// In en, this message translates to:
  /// **'Wallet ID (mobile number)'**
  String get profileWalletId;

  /// No description provided for @profileAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available for new work'**
  String get profileAvailable;

  /// No description provided for @profileAvailableHint.
  ///
  /// In en, this message translates to:
  /// **'Employers on KaamSathi can find you for new jobs.'**
  String get profileAvailableHint;

  /// No description provided for @profileConsents.
  ///
  /// In en, this message translates to:
  /// **'Your data & privacy'**
  String get profileConsents;

  /// No description provided for @profileConsentsHint.
  ///
  /// In en, this message translates to:
  /// **'You decide who can see your details. You can change this any time.'**
  String get profileConsentsHint;

  /// No description provided for @consentDataProcessing.
  ///
  /// In en, this message translates to:
  /// **'Use my details for hajiri and talab'**
  String get consentDataProcessing;

  /// No description provided for @consentDataProcessingHint.
  ///
  /// In en, this message translates to:
  /// **'Needed so your employer can record your hajiri and pay your talab.'**
  String get consentDataProcessingHint;

  /// No description provided for @consentProfileShare.
  ///
  /// In en, this message translates to:
  /// **'Show my profile to employers'**
  String get consentProfileShare;

  /// No description provided for @consentProfileShareHint.
  ///
  /// In en, this message translates to:
  /// **'Employers looking for workers can see your skills and contact you.'**
  String get consentProfileShareHint;

  /// No description provided for @consentHistoryShare.
  ///
  /// In en, this message translates to:
  /// **'Share my work history'**
  String get consentHistoryShare;

  /// No description provided for @consentHistoryShareHint.
  ///
  /// In en, this message translates to:
  /// **'New employers can see where you worked before and your ratings.'**
  String get consentHistoryShareHint;

  /// No description provided for @profileVerification.
  ///
  /// In en, this message translates to:
  /// **'Verification'**
  String get profileVerification;

  /// No description provided for @verUnverified.
  ///
  /// In en, this message translates to:
  /// **'Not verified'**
  String get verUnverified;

  /// No description provided for @verPending.
  ///
  /// In en, this message translates to:
  /// **'Verification pending'**
  String get verPending;

  /// No description provided for @verRejected.
  ///
  /// In en, this message translates to:
  /// **'Verification rejected'**
  String get verRejected;

  /// No description provided for @profileEditPayment.
  ///
  /// In en, this message translates to:
  /// **'Edit payment details'**
  String get profileEditPayment;

  /// No description provided for @profileNotLinked.
  ///
  /// In en, this message translates to:
  /// **'Your worker profile is not linked yet.'**
  String get profileNotLinked;

  /// No description provided for @appVersion.
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String appVersion(String version);

  /// No description provided for @ecoComingSoon.
  ///
  /// In en, this message translates to:
  /// **'This feature is coming soon. Please check again later.'**
  String get ecoComingSoon;

  /// No description provided for @ecoOfflineCached.
  ///
  /// In en, this message translates to:
  /// **'Offline — showing your last saved information.'**
  String get ecoOfflineCached;

  /// No description provided for @ecoPdfNotReady.
  ///
  /// In en, this message translates to:
  /// **'The PDF is not ready yet. Please try again later.'**
  String get ecoPdfNotReady;

  /// No description provided for @ecoCopied.
  ///
  /// In en, this message translates to:
  /// **'Copied'**
  String get ecoCopied;

  /// No description provided for @ecoCopyLink.
  ///
  /// In en, this message translates to:
  /// **'Copy link'**
  String get ecoCopyLink;

  /// No description provided for @ecoSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit'**
  String get ecoSubmit;

  /// No description provided for @ecoRequired.
  ///
  /// In en, this message translates to:
  /// **'Please fill this in.'**
  String get ecoRequired;

  /// No description provided for @ecoOptional.
  ///
  /// In en, this message translates to:
  /// **'{label} (optional)'**
  String ecoOptional(String label);

  /// No description provided for @ecoAdd.
  ///
  /// In en, this message translates to:
  /// **'Add'**
  String get ecoAdd;

  /// No description provided for @ecoRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get ecoRemove;

  /// No description provided for @ecoRevoke.
  ///
  /// In en, this message translates to:
  /// **'Revoke'**
  String get ecoRevoke;

  /// No description provided for @ecoView.
  ///
  /// In en, this message translates to:
  /// **'View'**
  String get ecoView;

  /// No description provided for @ecoNone.
  ///
  /// In en, this message translates to:
  /// **'None'**
  String get ecoNone;

  /// No description provided for @ecoDays.
  ///
  /// In en, this message translates to:
  /// **'{days} days'**
  String ecoDays(String days);

  /// No description provided for @ecoUntil.
  ///
  /// In en, this message translates to:
  /// **'Until {date}'**
  String ecoUntil(String date);

  /// No description provided for @ecoOn.
  ///
  /// In en, this message translates to:
  /// **'On {date}'**
  String ecoOn(String date);

  /// No description provided for @ecoStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get ecoStatus;

  /// No description provided for @ecoGroupWork.
  ///
  /// In en, this message translates to:
  /// **'My work'**
  String get ecoGroupWork;

  /// No description provided for @ecoGroupSkills.
  ///
  /// In en, this message translates to:
  /// **'Skills & training'**
  String get ecoGroupSkills;

  /// No description provided for @ecoGroupMoney.
  ///
  /// In en, this message translates to:
  /// **'Money'**
  String get ecoGroupMoney;

  /// No description provided for @ecoGroupPrivacy.
  ///
  /// In en, this message translates to:
  /// **'Privacy & help'**
  String get ecoGroupPrivacy;

  /// No description provided for @ecoChooseDate.
  ///
  /// In en, this message translates to:
  /// **'Choose date'**
  String get ecoChooseDate;

  /// No description provided for @ecoYears.
  ///
  /// In en, this message translates to:
  /// **'{years} yrs'**
  String ecoYears(String years);

  /// No description provided for @trustTitle.
  ///
  /// In en, this message translates to:
  /// **'My reliability'**
  String get trustTitle;

  /// No description provided for @trustScoreLabel.
  ///
  /// In en, this message translates to:
  /// **'Reliability score'**
  String get trustScoreLabel;

  /// No description provided for @trustScoreOutOf.
  ///
  /// In en, this message translates to:
  /// **'{score} out of 100'**
  String trustScoreOutOf(String score);

  /// No description provided for @trustScoreNone.
  ///
  /// In en, this message translates to:
  /// **'Your score appears after your first job on KaamSathi.'**
  String get trustScoreNone;

  /// No description provided for @trustLevelN.
  ///
  /// In en, this message translates to:
  /// **'Level {level}'**
  String trustLevelN(String level);

  /// No description provided for @trustLevel0.
  ///
  /// In en, this message translates to:
  /// **'Phone verified'**
  String get trustLevel0;

  /// No description provided for @trustLevel1.
  ///
  /// In en, this message translates to:
  /// **'Identity verified'**
  String get trustLevel1;

  /// No description provided for @trustLevel2.
  ///
  /// In en, this message translates to:
  /// **'Employment verified'**
  String get trustLevel2;

  /// No description provided for @trustLevel3.
  ///
  /// In en, this message translates to:
  /// **'Skills assessed'**
  String get trustLevel3;

  /// No description provided for @trustLevel4.
  ///
  /// In en, this message translates to:
  /// **'Certificate verified'**
  String get trustLevel4;

  /// No description provided for @trustLevel5.
  ///
  /// In en, this message translates to:
  /// **'Highly trusted'**
  String get trustLevel5;

  /// No description provided for @trustBreakdown.
  ///
  /// In en, this message translates to:
  /// **'What makes up your score'**
  String get trustBreakdown;

  /// No description provided for @trustCompEmployerFeedback.
  ///
  /// In en, this message translates to:
  /// **'Employer feedback'**
  String get trustCompEmployerFeedback;

  /// No description provided for @trustCompAttendance.
  ///
  /// In en, this message translates to:
  /// **'Hajiri (attendance)'**
  String get trustCompAttendance;

  /// No description provided for @trustCompCompletion.
  ///
  /// In en, this message translates to:
  /// **'Jobs completed'**
  String get trustCompCompletion;

  /// No description provided for @trustCompSkills.
  ///
  /// In en, this message translates to:
  /// **'Skills verified'**
  String get trustCompSkills;

  /// No description provided for @trustCompRepeatHiring.
  ///
  /// In en, this message translates to:
  /// **'Hired again'**
  String get trustCompRepeatHiring;

  /// No description provided for @trustCompStability.
  ///
  /// In en, this message translates to:
  /// **'Stability'**
  String get trustCompStability;

  /// No description provided for @trustNextSteps.
  ///
  /// In en, this message translates to:
  /// **'How to raise your score'**
  String get trustNextSteps;

  /// No description provided for @trustNotCredit.
  ///
  /// In en, this message translates to:
  /// **'This score comes only from your verified work record — hajiri, ratings and skills.'**
  String get trustNotCredit;

  /// No description provided for @profileViewsTitle.
  ///
  /// In en, this message translates to:
  /// **'Who viewed my profile'**
  String get profileViewsTitle;

  /// No description provided for @profileViewsHint.
  ///
  /// In en, this message translates to:
  /// **'Every time an employer, partner or the KaamSathi team opens your full profile, it is listed here.'**
  String get profileViewsHint;

  /// No description provided for @profileViewsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nobody has opened your full profile yet.'**
  String get profileViewsEmpty;

  /// No description provided for @viewByKaamSathi.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi team or shared link'**
  String get viewByKaamSathi;

  /// No description provided for @viewCtxApplication.
  ///
  /// In en, this message translates to:
  /// **'Job application'**
  String get viewCtxApplication;

  /// No description provided for @viewCtxEmployment.
  ///
  /// In en, this message translates to:
  /// **'Your employer'**
  String get viewCtxEmployment;

  /// No description provided for @viewCtxOps.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi verification'**
  String get viewCtxOps;

  /// No description provided for @viewCtxPartner.
  ///
  /// In en, this message translates to:
  /// **'Partner (with your consent)'**
  String get viewCtxPartner;

  /// No description provided for @viewCtxPassport.
  ///
  /// In en, this message translates to:
  /// **'Skill Passport link'**
  String get viewCtxPassport;

  /// No description provided for @viewCtxCrew.
  ///
  /// In en, this message translates to:
  /// **'Your team lead'**
  String get viewCtxCrew;

  /// No description provided for @disputesTitle.
  ///
  /// In en, this message translates to:
  /// **'Complaints'**
  String get disputesTitle;

  /// No description provided for @disputesHint.
  ///
  /// In en, this message translates to:
  /// **'Something wrong in your hajiri, talab or work record? Tell us. Your employer will be asked to respond and KaamSathi will review it.'**
  String get disputesHint;

  /// No description provided for @disputesEmpty.
  ///
  /// In en, this message translates to:
  /// **'You have not raised any complaint.'**
  String get disputesEmpty;

  /// No description provided for @disputeRaise.
  ///
  /// In en, this message translates to:
  /// **'Raise a complaint'**
  String get disputeRaise;

  /// No description provided for @disputeKindLabel.
  ///
  /// In en, this message translates to:
  /// **'What is it about?'**
  String get disputeKindLabel;

  /// No description provided for @disputeKindAttendance.
  ///
  /// In en, this message translates to:
  /// **'Hajiri (attendance)'**
  String get disputeKindAttendance;

  /// No description provided for @disputeKindWage.
  ///
  /// In en, this message translates to:
  /// **'Talab (wage)'**
  String get disputeKindWage;

  /// No description provided for @disputeKindEmploymentDates.
  ///
  /// In en, this message translates to:
  /// **'Job start/end dates'**
  String get disputeKindEmploymentDates;

  /// No description provided for @disputeKindRating.
  ///
  /// In en, this message translates to:
  /// **'Rating'**
  String get disputeKindRating;

  /// No description provided for @disputeKindIdentity.
  ///
  /// In en, this message translates to:
  /// **'My identity details'**
  String get disputeKindIdentity;

  /// No description provided for @disputeKindOther.
  ///
  /// In en, this message translates to:
  /// **'Something else'**
  String get disputeKindOther;

  /// No description provided for @disputeStatusOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get disputeStatusOpen;

  /// No description provided for @disputeStatusResponded.
  ///
  /// In en, this message translates to:
  /// **'Employer replied'**
  String get disputeStatusResponded;

  /// No description provided for @disputeStatusResolved.
  ///
  /// In en, this message translates to:
  /// **'Resolved'**
  String get disputeStatusResolved;

  /// No description provided for @disputeStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Not accepted'**
  String get disputeStatusRejected;

  /// No description provided for @disputeEmployment.
  ///
  /// In en, this message translates to:
  /// **'Which job?'**
  String get disputeEmployment;

  /// No description provided for @disputePayslip.
  ///
  /// In en, this message translates to:
  /// **'Which payslip?'**
  String get disputePayslip;

  /// No description provided for @disputeDate.
  ///
  /// In en, this message translates to:
  /// **'Which date?'**
  String get disputeDate;

  /// No description provided for @disputeDescription.
  ///
  /// In en, this message translates to:
  /// **'What is wrong?'**
  String get disputeDescription;

  /// No description provided for @disputeDescriptionHint.
  ///
  /// In en, this message translates to:
  /// **'Explain in your own words. For example: I worked on this day but it shows absent.'**
  String get disputeDescriptionHint;

  /// No description provided for @disputeDescriptionShort.
  ///
  /// In en, this message translates to:
  /// **'Please write at least 10 letters.'**
  String get disputeDescriptionShort;

  /// No description provided for @disputeSent.
  ///
  /// In en, this message translates to:
  /// **'Complaint sent. We will let you know.'**
  String get disputeSent;

  /// No description provided for @disputeEmployerNote.
  ///
  /// In en, this message translates to:
  /// **'Employer\'s reply'**
  String get disputeEmployerNote;

  /// No description provided for @disputeResolution.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi decision'**
  String get disputeResolution;

  /// No description provided for @disputeRaisedOn.
  ///
  /// In en, this message translates to:
  /// **'Raised on {date}'**
  String disputeRaisedOn(String date);

  /// No description provided for @disputeReviewNote.
  ///
  /// In en, this message translates to:
  /// **'Records are changed only after your employer and KaamSathi check them.'**
  String get disputeReviewNote;

  /// No description provided for @rateTitle.
  ///
  /// In en, this message translates to:
  /// **'Rate employer'**
  String get rateTitle;

  /// No description provided for @rateHint.
  ///
  /// In en, this message translates to:
  /// **'Your rating helps other workers. Only averages from several workers are used — your name is never shown to the employer.'**
  String get rateHint;

  /// No description provided for @ratePayOnTime.
  ///
  /// In en, this message translates to:
  /// **'Paid on time'**
  String get ratePayOnTime;

  /// No description provided for @rateConditions.
  ///
  /// In en, this message translates to:
  /// **'Working conditions'**
  String get rateConditions;

  /// No description provided for @rateComment.
  ///
  /// In en, this message translates to:
  /// **'Comment'**
  String get rateComment;

  /// No description provided for @ratePickStars.
  ///
  /// In en, this message translates to:
  /// **'Please choose stars for both questions.'**
  String get ratePickStars;

  /// No description provided for @rateSent.
  ///
  /// In en, this message translates to:
  /// **'Thank you! Your rating was saved.'**
  String get rateSent;

  /// No description provided for @rateAlready.
  ///
  /// In en, this message translates to:
  /// **'You have already rated this employer for this job.'**
  String get rateAlready;

  /// No description provided for @rateNotYet.
  ///
  /// In en, this message translates to:
  /// **'You can rate after 30 days of work or when the job ends.'**
  String get rateNotYet;

  /// No description provided for @empActive.
  ///
  /// In en, this message translates to:
  /// **'Current job'**
  String get empActive;

  /// No description provided for @empEnded.
  ///
  /// In en, this message translates to:
  /// **'Ended'**
  String get empEnded;

  /// No description provided for @empDetails.
  ///
  /// In en, this message translates to:
  /// **'Job details'**
  String get empDetails;

  /// No description provided for @empDesignation.
  ///
  /// In en, this message translates to:
  /// **'Position'**
  String get empDesignation;

  /// No description provided for @empStart.
  ///
  /// In en, this message translates to:
  /// **'Started'**
  String get empStart;

  /// No description provided for @empEndDate.
  ///
  /// In en, this message translates to:
  /// **'Ended on'**
  String get empEndDate;

  /// No description provided for @empWage.
  ///
  /// In en, this message translates to:
  /// **'Wage'**
  String get empWage;

  /// No description provided for @empWageMonthly.
  ///
  /// In en, this message translates to:
  /// **'{amount} per month'**
  String empWageMonthly(String amount);

  /// No description provided for @empWageDaily.
  ///
  /// In en, this message translates to:
  /// **'{amount} per day'**
  String empWageDaily(String amount);

  /// No description provided for @empSsfYes.
  ///
  /// In en, this message translates to:
  /// **'Enrolled'**
  String get empSsfYes;

  /// No description provided for @empSsfNo.
  ///
  /// In en, this message translates to:
  /// **'Not enrolled'**
  String get empSsfNo;

  /// No description provided for @empRated.
  ///
  /// In en, this message translates to:
  /// **'You have rated this employer.'**
  String get empRated;

  /// No description provided for @contractTitle.
  ///
  /// In en, this message translates to:
  /// **'Employment contract'**
  String get contractTitle;

  /// No description provided for @contractAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted on {date}'**
  String contractAccepted(String date);

  /// No description provided for @contractNotAccepted.
  ///
  /// In en, this message translates to:
  /// **'Not accepted yet'**
  String get contractNotAccepted;

  /// No description provided for @contractUnknown.
  ///
  /// In en, this message translates to:
  /// **'Open the contract to read it. Accept it here when you agree.'**
  String get contractUnknown;

  /// No description provided for @contractNone.
  ///
  /// In en, this message translates to:
  /// **'Your employer has not made a contract for this job yet.'**
  String get contractNone;

  /// No description provided for @contractOpenPdf.
  ///
  /// In en, this message translates to:
  /// **'Open contract (PDF)'**
  String get contractOpenPdf;

  /// No description provided for @contractReview.
  ///
  /// In en, this message translates to:
  /// **'Review and accept'**
  String get contractReview;

  /// No description provided for @contractVersion.
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String contractVersion(String version);

  /// No description provided for @contractAcceptTitle.
  ///
  /// In en, this message translates to:
  /// **'Accept your contract'**
  String get contractAcceptTitle;

  /// No description provided for @contractSummaryIntro.
  ///
  /// In en, this message translates to:
  /// **'Please read this summary. This is what your employer promises you.'**
  String get contractSummaryIntro;

  /// No description provided for @contractReadIn.
  ///
  /// In en, this message translates to:
  /// **'Read in'**
  String get contractReadIn;

  /// No description provided for @csEmployer.
  ///
  /// In en, this message translates to:
  /// **'Employer: {org}'**
  String csEmployer(String org);

  /// No description provided for @csPosition.
  ///
  /// In en, this message translates to:
  /// **'Position: {designation}'**
  String csPosition(String designation);

  /// No description provided for @csSite.
  ///
  /// In en, this message translates to:
  /// **'Work site: {site}'**
  String csSite(String site);

  /// No description provided for @csStart.
  ///
  /// In en, this message translates to:
  /// **'Start date: {date}'**
  String csStart(String date);

  /// No description provided for @csWageMonthly.
  ///
  /// In en, this message translates to:
  /// **'Basic salary {basic} + dearness allowance {da} = {total} per month.'**
  String csWageMonthly(String basic, String da, String total);

  /// No description provided for @csWageDaily.
  ///
  /// In en, this message translates to:
  /// **'Daily wage (jyala): {amount}.'**
  String csWageDaily(String amount);

  /// No description provided for @csAllowance.
  ///
  /// In en, this message translates to:
  /// **'Other allowance: {amount} per month.'**
  String csAllowance(String amount);

  /// No description provided for @csHours.
  ///
  /// In en, this message translates to:
  /// **'Working hours: 8 hours a day, 48 hours a week, with one weekly day off.'**
  String get csHours;

  /// No description provided for @csOvertime.
  ///
  /// In en, this message translates to:
  /// **'Overtime is paid at 1.5 times your hourly rate.'**
  String get csOvertime;

  /// No description provided for @csLeave.
  ///
  /// In en, this message translates to:
  /// **'Leave: 1 day home leave for every 20 days worked, 12 days sick leave a year, 13 days mourning leave, 98 days maternity or 15 days paternity leave.'**
  String get csLeave;

  /// No description provided for @csFestival.
  ///
  /// In en, this message translates to:
  /// **'Dashain allowance: one month\'s basic salary each year.'**
  String get csFestival;

  /// No description provided for @csSsfYes.
  ///
  /// In en, this message translates to:
  /// **'You are enrolled in SSF: 11% of basic salary is deducted and your employer adds 20%.'**
  String get csSsfYes;

  /// No description provided for @csSsfNo.
  ///
  /// In en, this message translates to:
  /// **'You are not enrolled in SSF yet. Ask your employer about it.'**
  String get csSsfNo;

  /// No description provided for @csGrievance.
  ///
  /// In en, this message translates to:
  /// **'If something is wrong, you can raise a complaint in KaamSathi at any time.'**
  String get csGrievance;

  /// No description provided for @csPdfNote.
  ///
  /// In en, this message translates to:
  /// **'The full contract (PDF) has all the details, including probation and notice period. Open it before you accept.'**
  String get csPdfNote;

  /// No description provided for @contractAgree.
  ///
  /// In en, this message translates to:
  /// **'I have read and understood my contract.'**
  String get contractAgree;

  /// No description provided for @contractAccept.
  ///
  /// In en, this message translates to:
  /// **'Accept contract'**
  String get contractAccept;

  /// No description provided for @contractAcceptedMsg.
  ///
  /// In en, this message translates to:
  /// **'Contract accepted. A copy stays in your KaamSathi.'**
  String get contractAcceptedMsg;

  /// No description provided for @crewTitle.
  ///
  /// In en, this message translates to:
  /// **'My team (Naike)'**
  String get crewTitle;

  /// No description provided for @crewMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Add your workers and see referral rewards'**
  String get crewMenuSubtitle;

  /// No description provided for @crewBecomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Become a team lead (Naike)'**
  String get crewBecomeTitle;

  /// No description provided for @crewBecomeBody.
  ///
  /// In en, this message translates to:
  /// **'Bring your team to KaamSathi. When a worker you added gets a job and stays, KaamSathi pays you a referral reward. It is never taken from the worker\'s pay.'**
  String get crewBecomeBody;

  /// No description provided for @crewName.
  ///
  /// In en, this message translates to:
  /// **'Team name'**
  String get crewName;

  /// No description provided for @crewNameHint.
  ///
  /// In en, this message translates to:
  /// **'For example: Ram\'s mason team'**
  String get crewNameHint;

  /// No description provided for @crewCreate.
  ///
  /// In en, this message translates to:
  /// **'Start my team'**
  String get crewCreate;

  /// No description provided for @crewCreated.
  ///
  /// In en, this message translates to:
  /// **'Your team is ready. Add your members.'**
  String get crewCreated;

  /// No description provided for @crewMembers.
  ///
  /// In en, this message translates to:
  /// **'Members'**
  String get crewMembers;

  /// No description provided for @crewPlaced.
  ///
  /// In en, this message translates to:
  /// **'Got jobs (90 days)'**
  String get crewPlaced;

  /// No description provided for @crewEarned.
  ///
  /// In en, this message translates to:
  /// **'Earned'**
  String get crewEarned;

  /// No description provided for @crewPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get crewPending;

  /// No description provided for @crewAddMember.
  ///
  /// In en, this message translates to:
  /// **'Add member'**
  String get crewAddMember;

  /// No description provided for @crewMemberName.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get crewMemberName;

  /// No description provided for @crewTrade.
  ///
  /// In en, this message translates to:
  /// **'Trade'**
  String get crewTrade;

  /// No description provided for @crewYears.
  ///
  /// In en, this message translates to:
  /// **'Years of experience'**
  String get crewYears;

  /// No description provided for @crewAdded.
  ///
  /// In en, this message translates to:
  /// **'Added. We sent them an SMS invite.'**
  String get crewAdded;

  /// No description provided for @crewMemberConsentNote.
  ///
  /// In en, this message translates to:
  /// **'They will be asked to agree when they first log in. Their details are not shared before that.'**
  String get crewMemberConsentNote;

  /// No description provided for @crewRemoveConfirm.
  ///
  /// In en, this message translates to:
  /// **'Remove {name} from your team?'**
  String crewRemoveConfirm(String name);

  /// No description provided for @crewRemoved.
  ///
  /// In en, this message translates to:
  /// **'Removed from your team.'**
  String get crewRemoved;

  /// No description provided for @crewAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available for work'**
  String get crewAvailable;

  /// No description provided for @crewWorkingAt.
  ///
  /// In en, this message translates to:
  /// **'Working at {employer}'**
  String crewWorkingAt(String employer);

  /// No description provided for @crewNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'Not available'**
  String get crewNotAvailable;

  /// No description provided for @crewEmpty.
  ///
  /// In en, this message translates to:
  /// **'No members yet. Add the workers in your team.'**
  String get crewEmpty;

  /// No description provided for @crewReferrals.
  ///
  /// In en, this message translates to:
  /// **'Referral rewards'**
  String get crewReferrals;

  /// No description provided for @crewReferralsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No referral rewards yet.'**
  String get crewReferralsEmpty;

  /// No description provided for @crewRefPending.
  ///
  /// In en, this message translates to:
  /// **'Waiting'**
  String get crewRefPending;

  /// No description provided for @crewRefEligible.
  ///
  /// In en, this message translates to:
  /// **'Ready to pay'**
  String get crewRefEligible;

  /// No description provided for @crewRefPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get crewRefPaid;

  /// No description provided for @crewRefVoid.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get crewRefVoid;

  /// No description provided for @crewRefEligibleOn.
  ///
  /// In en, this message translates to:
  /// **'Ready on {date}'**
  String crewRefEligibleOn(String date);

  /// No description provided for @crewWorkersNeverPay.
  ///
  /// In en, this message translates to:
  /// **'Workers never pay. Rewards are paid by KaamSathi.'**
  String get crewWorkersNeverPay;

  /// No description provided for @credTitle.
  ///
  /// In en, this message translates to:
  /// **'Certificates & licences'**
  String get credTitle;

  /// No description provided for @credMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'NSTB, training certificates, driving licence'**
  String get credMenuSubtitle;

  /// No description provided for @credEmpty.
  ///
  /// In en, this message translates to:
  /// **'Add your NSTB certificate, training certificate or licence. Verified certificates raise your reliability score.'**
  String get credEmpty;

  /// No description provided for @credAdd.
  ///
  /// In en, this message translates to:
  /// **'Add certificate'**
  String get credAdd;

  /// No description provided for @credKind.
  ///
  /// In en, this message translates to:
  /// **'Type'**
  String get credKind;

  /// No description provided for @credKindNstb.
  ///
  /// In en, this message translates to:
  /// **'Skill certificate (NSTB)'**
  String get credKindNstb;

  /// No description provided for @credKindCtevt.
  ///
  /// In en, this message translates to:
  /// **'CTEVT training'**
  String get credKindCtevt;

  /// No description provided for @credKindCourse.
  ///
  /// In en, this message translates to:
  /// **'Training course'**
  String get credKindCourse;

  /// No description provided for @credKindLicense.
  ///
  /// In en, this message translates to:
  /// **'Licence'**
  String get credKindLicense;

  /// No description provided for @credKindSafety.
  ///
  /// In en, this message translates to:
  /// **'Safety training'**
  String get credKindSafety;

  /// No description provided for @credKindLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get credKindLanguage;

  /// No description provided for @credKindOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get credKindOther;

  /// No description provided for @credName.
  ///
  /// In en, this message translates to:
  /// **'Certificate name'**
  String get credName;

  /// No description provided for @credIssuer.
  ///
  /// In en, this message translates to:
  /// **'Issued by'**
  String get credIssuer;

  /// No description provided for @credNumber.
  ///
  /// In en, this message translates to:
  /// **'Certificate number'**
  String get credNumber;

  /// No description provided for @credLevel.
  ///
  /// In en, this message translates to:
  /// **'Level'**
  String get credLevel;

  /// No description provided for @credIssuedOn.
  ///
  /// In en, this message translates to:
  /// **'Issued on'**
  String get credIssuedOn;

  /// No description provided for @credExpiresOn.
  ///
  /// In en, this message translates to:
  /// **'Expires on'**
  String get credExpiresOn;

  /// No description provided for @credPhoto.
  ///
  /// In en, this message translates to:
  /// **'Photo of the document'**
  String get credPhoto;

  /// No description provided for @credTakePhoto.
  ///
  /// In en, this message translates to:
  /// **'Take photo'**
  String get credTakePhoto;

  /// No description provided for @credChoosePhoto.
  ///
  /// In en, this message translates to:
  /// **'Choose from gallery'**
  String get credChoosePhoto;

  /// No description provided for @credPhotoNeeded.
  ///
  /// In en, this message translates to:
  /// **'Please add a clear photo of the document.'**
  String get credPhotoNeeded;

  /// No description provided for @credPhotoError.
  ///
  /// In en, this message translates to:
  /// **'Could not open the camera or gallery.'**
  String get credPhotoError;

  /// No description provided for @credSaved.
  ///
  /// In en, this message translates to:
  /// **'Sent for checking. We will let you know.'**
  String get credSaved;

  /// No description provided for @credStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Checking'**
  String get credStatusPending;

  /// No description provided for @credStatusVerified.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get credStatusVerified;

  /// No description provided for @credStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Not accepted'**
  String get credStatusRejected;

  /// No description provided for @credStatusExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get credStatusExpired;

  /// No description provided for @credDeleteConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete this certificate?'**
  String get credDeleteConfirm;

  /// No description provided for @credDeleted.
  ///
  /// In en, this message translates to:
  /// **'Deleted.'**
  String get credDeleted;

  /// No description provided for @credExpires.
  ///
  /// In en, this message translates to:
  /// **'Expires {date}'**
  String credExpires(String date);

  /// No description provided for @credVerifyNote.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi checks every document before it is marked verified.'**
  String get credVerifyNote;

  /// No description provided for @nstbElementary.
  ///
  /// In en, this message translates to:
  /// **'Elementary'**
  String get nstbElementary;

  /// No description provided for @nstbLevelN.
  ///
  /// In en, this message translates to:
  /// **'Level {level}'**
  String nstbLevelN(String level);

  /// No description provided for @passportTitle.
  ///
  /// In en, this message translates to:
  /// **'Skill Passport'**
  String get passportTitle;

  /// No description provided for @passportMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your verified skills and work record to show employers'**
  String get passportMenuSubtitle;

  /// No description provided for @passportIntro.
  ///
  /// In en, this message translates to:
  /// **'Your Skill Passport shows only verified information. You decide who sees it.'**
  String get passportIntro;

  /// No description provided for @passportPublic.
  ///
  /// In en, this message translates to:
  /// **'Anyone with my passport code can view it'**
  String get passportPublic;

  /// No description provided for @passportPublicHint.
  ///
  /// In en, this message translates to:
  /// **'Turn off to keep it private. Your share links still work until they end.'**
  String get passportPublicHint;

  /// No description provided for @passportShowContact.
  ///
  /// In en, this message translates to:
  /// **'Show my phone number'**
  String get passportShowContact;

  /// No description provided for @passportShowContactHint.
  ///
  /// In en, this message translates to:
  /// **'Only on your public passport. Each share link has its own setting.'**
  String get passportShowContactHint;

  /// No description provided for @passportCode.
  ///
  /// In en, this message translates to:
  /// **'Passport code: {code}'**
  String passportCode(String code);

  /// No description provided for @passportOpenPdf.
  ///
  /// In en, this message translates to:
  /// **'Download PDF'**
  String get passportOpenPdf;

  /// No description provided for @passportPreview.
  ///
  /// In en, this message translates to:
  /// **'What others see'**
  String get passportPreview;

  /// No description provided for @passportShares.
  ///
  /// In en, this message translates to:
  /// **'Share links'**
  String get passportShares;

  /// No description provided for @passportSharesEmpty.
  ///
  /// In en, this message translates to:
  /// **'No share links yet. Create one to send your passport to an employer.'**
  String get passportSharesEmpty;

  /// No description provided for @passportNewShare.
  ///
  /// In en, this message translates to:
  /// **'Create share link'**
  String get passportNewShare;

  /// No description provided for @shareAudience.
  ///
  /// In en, this message translates to:
  /// **'Who is it for?'**
  String get shareAudience;

  /// No description provided for @shareAudienceHint.
  ///
  /// In en, this message translates to:
  /// **'For example: Hotel Everest HR'**
  String get shareAudienceHint;

  /// No description provided for @sharePurpose.
  ///
  /// In en, this message translates to:
  /// **'Why are you sharing?'**
  String get sharePurpose;

  /// No description provided for @sharePurposeJob.
  ///
  /// In en, this message translates to:
  /// **'Job application'**
  String get sharePurposeJob;

  /// No description provided for @sharePurposeAgency.
  ///
  /// In en, this message translates to:
  /// **'Recruitment agency'**
  String get sharePurposeAgency;

  /// No description provided for @sharePurposeBank.
  ///
  /// In en, this message translates to:
  /// **'Bank'**
  String get sharePurposeBank;

  /// No description provided for @sharePurposeOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get sharePurposeOther;

  /// No description provided for @shareAgencyNote.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi does not find jobs abroad. Share with a licensed agency only if you choose to.'**
  String get shareAgencyNote;

  /// No description provided for @shareDays.
  ///
  /// In en, this message translates to:
  /// **'Link works for'**
  String get shareDays;

  /// No description provided for @shareIncludeContact.
  ///
  /// In en, this message translates to:
  /// **'Include my phone number'**
  String get shareIncludeContact;

  /// No description provided for @shareCreated.
  ///
  /// In en, this message translates to:
  /// **'Link created and copied. Paste it in a message to send.'**
  String get shareCreated;

  /// No description provided for @shareViews.
  ///
  /// In en, this message translates to:
  /// **'{count} views'**
  String shareViews(String count);

  /// No description provided for @shareExpired.
  ///
  /// In en, this message translates to:
  /// **'Ended'**
  String get shareExpired;

  /// No description provided for @shareRevoked.
  ///
  /// In en, this message translates to:
  /// **'Stopped'**
  String get shareRevoked;

  /// No description provided for @shareActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get shareActive;

  /// No description provided for @shareRevokeConfirm.
  ///
  /// In en, this message translates to:
  /// **'Stop this link? Anyone who has it will no longer see your passport.'**
  String get shareRevokeConfirm;

  /// No description provided for @shareRevokedMsg.
  ///
  /// In en, this message translates to:
  /// **'Link stopped.'**
  String get shareRevokedMsg;

  /// No description provided for @ppIdentity.
  ///
  /// In en, this message translates to:
  /// **'Identity checks'**
  String get ppIdentity;

  /// No description provided for @ppCitizenship.
  ///
  /// In en, this message translates to:
  /// **'Citizenship'**
  String get ppCitizenship;

  /// No description provided for @ppPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get ppPhone;

  /// No description provided for @ppAddress.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get ppAddress;

  /// No description provided for @ppSkills.
  ///
  /// In en, this message translates to:
  /// **'Skills'**
  String get ppSkills;

  /// No description provided for @ppCredentials.
  ///
  /// In en, this message translates to:
  /// **'Verified certificates'**
  String get ppCredentials;

  /// No description provided for @ppWork.
  ///
  /// In en, this message translates to:
  /// **'Verified work'**
  String get ppWork;

  /// No description provided for @ppEmployers.
  ///
  /// In en, this message translates to:
  /// **'Employers'**
  String get ppEmployers;

  /// No description provided for @ppMonths.
  ///
  /// In en, this message translates to:
  /// **'Months worked'**
  String get ppMonths;

  /// No description provided for @ppJobsDone.
  ///
  /// In en, this message translates to:
  /// **'Jobs completed'**
  String get ppJobsDone;

  /// No description provided for @ppAttendance.
  ///
  /// In en, this message translates to:
  /// **'Attendance'**
  String get ppAttendance;

  /// No description provided for @ppAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available for work'**
  String get ppAvailable;

  /// No description provided for @ppNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'Not looking for work now'**
  String get ppNotAvailable;

  /// No description provided for @ppExpectedWage.
  ///
  /// In en, this message translates to:
  /// **'Expected wage'**
  String get ppExpectedWage;

  /// No description provided for @ppVerifyAt.
  ///
  /// In en, this message translates to:
  /// **'Anyone can check it at'**
  String get ppVerifyAt;

  /// No description provided for @trainTitle.
  ///
  /// In en, this message translates to:
  /// **'Training'**
  String get trainTitle;

  /// No description provided for @trainMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Courses that lead to better jobs'**
  String get trainMenuSubtitle;

  /// No description provided for @trainCourses.
  ///
  /// In en, this message translates to:
  /// **'Courses'**
  String get trainCourses;

  /// No description provided for @trainMine.
  ///
  /// In en, this message translates to:
  /// **'My enrolments'**
  String get trainMine;

  /// No description provided for @trainRecommended.
  ///
  /// In en, this message translates to:
  /// **'Recommended for you'**
  String get trainRecommended;

  /// No description provided for @trainEmpty.
  ///
  /// In en, this message translates to:
  /// **'No open courses right now. Please check again later.'**
  String get trainEmpty;

  /// No description provided for @trainMineEmpty.
  ///
  /// In en, this message translates to:
  /// **'You have not applied for any course yet.'**
  String get trainMineEmpty;

  /// No description provided for @trainApply.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get trainApply;

  /// No description provided for @trainApplyConfirm.
  ///
  /// In en, this message translates to:
  /// **'Apply for \"{course}\"?'**
  String trainApplyConfirm(String course);

  /// No description provided for @trainApplied.
  ///
  /// In en, this message translates to:
  /// **'Applied! The training centre will contact you.'**
  String get trainApplied;

  /// No description provided for @trainAlreadyApplied.
  ///
  /// In en, this message translates to:
  /// **'Applied'**
  String get trainAlreadyApplied;

  /// No description provided for @trainFee.
  ///
  /// In en, this message translates to:
  /// **'Fee: {amount}'**
  String trainFee(String amount);

  /// No description provided for @trainFree.
  ///
  /// In en, this message translates to:
  /// **'Free'**
  String get trainFree;

  /// No description provided for @trainStarts.
  ///
  /// In en, this message translates to:
  /// **'Starts {date}'**
  String trainStarts(String date);

  /// No description provided for @trainSeats.
  ///
  /// In en, this message translates to:
  /// **'{count} seats'**
  String trainSeats(String count);

  /// No description provided for @trainLeadsNstb.
  ///
  /// In en, this message translates to:
  /// **'Leads to NSTB skill test'**
  String get trainLeadsNstb;

  /// No description provided for @trainModeClassroom.
  ///
  /// In en, this message translates to:
  /// **'Classroom'**
  String get trainModeClassroom;

  /// No description provided for @trainModeOnSite.
  ///
  /// In en, this message translates to:
  /// **'At work site'**
  String get trainModeOnSite;

  /// No description provided for @trainModeOnline.
  ///
  /// In en, this message translates to:
  /// **'Online'**
  String get trainModeOnline;

  /// No description provided for @trainLevelBasic.
  ///
  /// In en, this message translates to:
  /// **'Basic'**
  String get trainLevelBasic;

  /// No description provided for @trainLevelRefresher.
  ///
  /// In en, this message translates to:
  /// **'Refresher'**
  String get trainLevelRefresher;

  /// No description provided for @trainFeeNote.
  ///
  /// In en, this message translates to:
  /// **'Any fee is paid to the training centre, never to KaamSathi.'**
  String get trainFeeNote;

  /// No description provided for @trainStatusApplied.
  ///
  /// In en, this message translates to:
  /// **'Applied'**
  String get trainStatusApplied;

  /// No description provided for @trainStatusEnrolled.
  ///
  /// In en, this message translates to:
  /// **'Enrolled'**
  String get trainStatusEnrolled;

  /// No description provided for @trainStatusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get trainStatusCompleted;

  /// No description provided for @trainStatusDropped.
  ///
  /// In en, this message translates to:
  /// **'Left'**
  String get trainStatusDropped;

  /// No description provided for @trainStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Not accepted'**
  String get trainStatusRejected;

  /// No description provided for @trainCompletedOn.
  ///
  /// In en, this message translates to:
  /// **'Completed on {date}'**
  String trainCompletedOn(String date);

  /// No description provided for @moneyTitle.
  ///
  /// In en, this message translates to:
  /// **'Money'**
  String get moneyTitle;

  /// No description provided for @moneyMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Verified earnings and offers from licensed partners'**
  String get moneyMenuSubtitle;

  /// No description provided for @moneyNoLend.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi does not lend money or charge you anything. Offers come from licensed partners.'**
  String get moneyNoLend;

  /// No description provided for @moneyTabEarnings.
  ///
  /// In en, this message translates to:
  /// **'Earnings'**
  String get moneyTabEarnings;

  /// No description provided for @moneyTabOffers.
  ///
  /// In en, this message translates to:
  /// **'Offers'**
  String get moneyTabOffers;

  /// No description provided for @moneyTabApplications.
  ///
  /// In en, this message translates to:
  /// **'Applied'**
  String get moneyTabApplications;

  /// No description provided for @moneyTabSharing.
  ///
  /// In en, this message translates to:
  /// **'Sharing'**
  String get moneyTabSharing;

  /// No description provided for @finVerifiedMonths.
  ///
  /// In en, this message translates to:
  /// **'Verified months'**
  String get finVerifiedMonths;

  /// No description provided for @finAvgNet.
  ///
  /// In en, this message translates to:
  /// **'Average monthly pay'**
  String get finAvgNet;

  /// No description provided for @finStability.
  ///
  /// In en, this message translates to:
  /// **'Income stability'**
  String get finStability;

  /// No description provided for @finStabilityHigh.
  ///
  /// In en, this message translates to:
  /// **'Steady'**
  String get finStabilityHigh;

  /// No description provided for @finStabilityMedium.
  ///
  /// In en, this message translates to:
  /// **'Changes a little'**
  String get finStabilityMedium;

  /// No description provided for @finStabilityLow.
  ///
  /// In en, this message translates to:
  /// **'Changes a lot'**
  String get finStabilityLow;

  /// No description provided for @finEmployers.
  ///
  /// In en, this message translates to:
  /// **'Employers'**
  String get finEmployers;

  /// No description provided for @finSsfMonths.
  ///
  /// In en, this message translates to:
  /// **'Months with SSF'**
  String get finSsfMonths;

  /// No description provided for @finRange.
  ///
  /// In en, this message translates to:
  /// **'Lowest {min} · Highest {max}'**
  String finRange(String min, String max);

  /// No description provided for @finMonthly.
  ///
  /// In en, this message translates to:
  /// **'Salary by month'**
  String get finMonthly;

  /// No description provided for @finPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get finPaid;

  /// No description provided for @finUnpaid.
  ///
  /// In en, this message translates to:
  /// **'Not paid yet'**
  String get finUnpaid;

  /// No description provided for @finEmpty.
  ///
  /// In en, this message translates to:
  /// **'Your verified earnings appear after your first salary is paid through KaamSathi.'**
  String get finEmpty;

  /// No description provided for @finHint.
  ///
  /// In en, this message translates to:
  /// **'Built only from salaries your employer paid and recorded on KaamSathi.'**
  String get finHint;

  /// No description provided for @offerByRegulated.
  ///
  /// In en, this message translates to:
  /// **'Offered by {partner}, regulated by {regulator}'**
  String offerByRegulated(String partner, String regulator);

  /// No description provided for @offerBy.
  ///
  /// In en, this message translates to:
  /// **'Offered by {partner}'**
  String offerBy(String partner);

  /// No description provided for @regNrb.
  ///
  /// In en, this message translates to:
  /// **'Nepal Rastra Bank (NRB)'**
  String get regNrb;

  /// No description provided for @regBeema.
  ///
  /// In en, this message translates to:
  /// **'Nepal Insurance Authority'**
  String get regBeema;

  /// No description provided for @regDofe.
  ///
  /// In en, this message translates to:
  /// **'Department of Foreign Employment'**
  String get regDofe;

  /// No description provided for @regCtevt.
  ///
  /// In en, this message translates to:
  /// **'CTEVT'**
  String get regCtevt;

  /// No description provided for @offerKindLoan.
  ///
  /// In en, this message translates to:
  /// **'Loan'**
  String get offerKindLoan;

  /// No description provided for @offerKindEwa.
  ///
  /// In en, this message translates to:
  /// **'Early salary (already earned)'**
  String get offerKindEwa;

  /// No description provided for @offerKindInsurance.
  ///
  /// In en, this message translates to:
  /// **'Insurance'**
  String get offerKindInsurance;

  /// No description provided for @offerKindSavings.
  ///
  /// In en, this message translates to:
  /// **'Savings'**
  String get offerKindSavings;

  /// No description provided for @offerKindTool.
  ///
  /// In en, this message translates to:
  /// **'Tool finance'**
  String get offerKindTool;

  /// No description provided for @offerKindVehicle.
  ///
  /// In en, this message translates to:
  /// **'Vehicle finance'**
  String get offerKindVehicle;

  /// No description provided for @offerEligible.
  ///
  /// In en, this message translates to:
  /// **'You qualify'**
  String get offerEligible;

  /// No description provided for @offerNotEligible.
  ///
  /// In en, this message translates to:
  /// **'Not yet'**
  String get offerNotEligible;

  /// No description provided for @offerUpTo.
  ///
  /// In en, this message translates to:
  /// **'Up to {amount}'**
  String offerUpTo(String amount);

  /// No description provided for @offerMinMonths.
  ///
  /// In en, this message translates to:
  /// **'Needs {months} verified months'**
  String offerMinMonths(String months);

  /// No description provided for @offerMinAvg.
  ///
  /// In en, this message translates to:
  /// **'Needs average pay of {amount}'**
  String offerMinAvg(String amount);

  /// No description provided for @offerTerms.
  ///
  /// In en, this message translates to:
  /// **'Partner\'s terms: {note}'**
  String offerTerms(String note);

  /// No description provided for @offerApply.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get offerApply;

  /// No description provided for @offersEmpty.
  ///
  /// In en, this message translates to:
  /// **'No job offers yet.'**
  String get offersEmpty;

  /// No description provided for @offerApplied.
  ///
  /// In en, this message translates to:
  /// **'Application sent to {partner}. They will contact you.'**
  String offerApplied(String partner);

  /// No description provided for @partnersTitle.
  ///
  /// In en, this message translates to:
  /// **'Our partners'**
  String get partnersTitle;

  /// No description provided for @partnerKindBank.
  ///
  /// In en, this message translates to:
  /// **'Bank'**
  String get partnerKindBank;

  /// No description provided for @partnerKindMicrofinance.
  ///
  /// In en, this message translates to:
  /// **'Microfinance'**
  String get partnerKindMicrofinance;

  /// No description provided for @partnerKindInsurer.
  ///
  /// In en, this message translates to:
  /// **'Insurance company'**
  String get partnerKindInsurer;

  /// No description provided for @partnerKindWallet.
  ///
  /// In en, this message translates to:
  /// **'Digital wallet'**
  String get partnerKindWallet;

  /// No description provided for @partnerKindTraining.
  ///
  /// In en, this message translates to:
  /// **'Training'**
  String get partnerKindTraining;

  /// No description provided for @partnerKindAgency.
  ///
  /// In en, this message translates to:
  /// **'Recruitment agency'**
  String get partnerKindAgency;

  /// No description provided for @partnerKindGovernment.
  ///
  /// In en, this message translates to:
  /// **'Government'**
  String get partnerKindGovernment;

  /// No description provided for @consentTitle.
  ///
  /// In en, this message translates to:
  /// **'Share your data — your choice'**
  String get consentTitle;

  /// No description provided for @consentIntro.
  ///
  /// In en, this message translates to:
  /// **'To apply, {partner} needs to see some of your KaamSathi data. Read what will be shared before you agree.'**
  String consentIntro(String partner);

  /// No description provided for @consentPartner.
  ///
  /// In en, this message translates to:
  /// **'Who gets it'**
  String get consentPartner;

  /// No description provided for @consentPurpose.
  ///
  /// In en, this message translates to:
  /// **'Why'**
  String get consentPurpose;

  /// No description provided for @consentPurposeLoan.
  ///
  /// In en, this message translates to:
  /// **'To check if you can get this loan'**
  String get consentPurposeLoan;

  /// No description provided for @consentPurposeInsurance.
  ///
  /// In en, this message translates to:
  /// **'To offer you this insurance'**
  String get consentPurposeInsurance;

  /// No description provided for @consentPurposeEwa.
  ///
  /// In en, this message translates to:
  /// **'To give you part of your earned salary early'**
  String get consentPurposeEwa;

  /// No description provided for @consentScopes.
  ///
  /// In en, this message translates to:
  /// **'What they can see'**
  String get consentScopes;

  /// No description provided for @scopeEarnings.
  ///
  /// In en, this message translates to:
  /// **'Your verified salary: monthly pay, months worked and employer names'**
  String get scopeEarnings;

  /// No description provided for @scopeProfile.
  ///
  /// In en, this message translates to:
  /// **'Your Skill Passport: name, skills, reliability score and verified work record'**
  String get scopeProfile;

  /// No description provided for @scopePassport.
  ///
  /// In en, this message translates to:
  /// **'Your Skill Passport'**
  String get scopePassport;

  /// No description provided for @scopeReferrals.
  ///
  /// In en, this message translates to:
  /// **'Update the status of this application'**
  String get scopeReferrals;

  /// No description provided for @consentNotShared.
  ///
  /// In en, this message translates to:
  /// **'They will NOT see your citizenship or ID documents, or your bank account details.'**
  String get consentNotShared;

  /// No description provided for @consentDuration.
  ///
  /// In en, this message translates to:
  /// **'For how long'**
  String get consentDuration;

  /// No description provided for @consentDurationUntil.
  ///
  /// In en, this message translates to:
  /// **'{days} days — until {date}'**
  String consentDurationUntil(String days, String date);

  /// No description provided for @consentRevoke.
  ///
  /// In en, this message translates to:
  /// **'You can stop sharing at any time from Money → Sharing. Every time they look, you will see it there.'**
  String get consentRevoke;

  /// No description provided for @consentNoLend.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi does not lend you money and does not charge you. Any loan or insurance is between you and {partner}.'**
  String consentNoLend(String partner);

  /// No description provided for @consentAmount.
  ///
  /// In en, this message translates to:
  /// **'Amount you need'**
  String get consentAmount;

  /// No description provided for @consentNote.
  ///
  /// In en, this message translates to:
  /// **'What is it for?'**
  String get consentNote;

  /// No description provided for @consentAgree.
  ///
  /// In en, this message translates to:
  /// **'I agree to share this data with {partner} for this purpose.'**
  String consentAgree(String partner);

  /// No description provided for @consentApply.
  ///
  /// In en, this message translates to:
  /// **'Agree and apply'**
  String get consentApply;

  /// No description provided for @refsEmpty.
  ///
  /// In en, this message translates to:
  /// **'You have not applied for any offer.'**
  String get refsEmpty;

  /// No description provided for @refStatusSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Sent'**
  String get refStatusSubmitted;

  /// No description provided for @refStatusReview.
  ///
  /// In en, this message translates to:
  /// **'Being reviewed'**
  String get refStatusReview;

  /// No description provided for @refStatusApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get refStatusApproved;

  /// No description provided for @refStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Not approved'**
  String get refStatusRejected;

  /// No description provided for @refStatusDisbursed.
  ///
  /// In en, this message translates to:
  /// **'Money given'**
  String get refStatusDisbursed;

  /// No description provided for @refStatusClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get refStatusClosed;

  /// No description provided for @refAmountRequested.
  ///
  /// In en, this message translates to:
  /// **'Asked: {amount}'**
  String refAmountRequested(String amount);

  /// No description provided for @refAmountApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved: {amount}'**
  String refAmountApproved(String amount);

  /// No description provided for @grantsTitle.
  ///
  /// In en, this message translates to:
  /// **'Who can see my data'**
  String get grantsTitle;

  /// No description provided for @grantsEmpty.
  ///
  /// In en, this message translates to:
  /// **'You are not sharing data with any partner.'**
  String get grantsEmpty;

  /// No description provided for @grantActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get grantActive;

  /// No description provided for @grantExpired.
  ///
  /// In en, this message translates to:
  /// **'Ended'**
  String get grantExpired;

  /// No description provided for @grantRevoked.
  ///
  /// In en, this message translates to:
  /// **'Stopped'**
  String get grantRevoked;

  /// No description provided for @grantRevokeConfirm.
  ///
  /// In en, this message translates to:
  /// **'Stop sharing with {partner}? They will not be able to see your data any more.'**
  String grantRevokeConfirm(String partner);

  /// No description provided for @grantRevokedMsg.
  ///
  /// In en, this message translates to:
  /// **'Sharing stopped.'**
  String get grantRevokedMsg;

  /// No description provided for @accessLog.
  ///
  /// In en, this message translates to:
  /// **'When partners looked'**
  String get accessLog;

  /// No description provided for @accessEmpty.
  ///
  /// In en, this message translates to:
  /// **'No partner has looked at your data.'**
  String get accessEmpty;

  /// No description provided for @scopeShortEarnings.
  ///
  /// In en, this message translates to:
  /// **'Earnings'**
  String get scopeShortEarnings;

  /// No description provided for @scopeShortProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get scopeShortProfile;

  /// No description provided for @scopeShortPassport.
  ///
  /// In en, this message translates to:
  /// **'Skill Passport'**
  String get scopeShortPassport;

  /// No description provided for @scopeShortReferrals.
  ///
  /// In en, this message translates to:
  /// **'Application status'**
  String get scopeShortReferrals;

  /// No description provided for @privacyTitle.
  ///
  /// In en, this message translates to:
  /// **'My data'**
  String get privacyTitle;

  /// No description provided for @privacyMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Get a copy, correct it or delete it'**
  String get privacyMenuSubtitle;

  /// No description provided for @privacyIntro.
  ///
  /// In en, this message translates to:
  /// **'Under Nepal\'s Individual Privacy Act 2075, you can get a copy of your data, ask us to correct it, or ask us to delete it.'**
  String get privacyIntro;

  /// No description provided for @privacyExport.
  ///
  /// In en, this message translates to:
  /// **'Get a copy of my data'**
  String get privacyExport;

  /// No description provided for @privacyExportHint.
  ///
  /// In en, this message translates to:
  /// **'We prepare a file with everything we hold about you. It can take a while. The download link works for a limited time.'**
  String get privacyExportHint;

  /// No description provided for @privacyCorrection.
  ///
  /// In en, this message translates to:
  /// **'Correct my data'**
  String get privacyCorrection;

  /// No description provided for @privacyCorrectionHint.
  ///
  /// In en, this message translates to:
  /// **'Tell us what is wrong. KaamSathi will check and fix it.'**
  String get privacyCorrectionHint;

  /// No description provided for @privacyCorrectionField.
  ///
  /// In en, this message translates to:
  /// **'What should be corrected?'**
  String get privacyCorrectionField;

  /// No description provided for @privacyDeletion.
  ///
  /// In en, this message translates to:
  /// **'Delete my data'**
  String get privacyDeletion;

  /// No description provided for @privacyDeletionHint.
  ///
  /// In en, this message translates to:
  /// **'Remove your profile, photos and documents from KaamSathi.'**
  String get privacyDeletionHint;

  /// No description provided for @privacyDeletionWarning.
  ///
  /// In en, this message translates to:
  /// **'Please read before you continue: your name, phone number, photos and documents will be removed, and your Skill Passport and all data sharing will stop. Hajiri and payroll records that your employer must keep by law will stay, but without your name. This cannot be undone.'**
  String get privacyDeletionWarning;

  /// No description provided for @privacyDeletionConfirm.
  ///
  /// In en, this message translates to:
  /// **'I understand. Delete my data.'**
  String get privacyDeletionConfirm;

  /// No description provided for @privacyReason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get privacyReason;

  /// No description provided for @privacyRequests.
  ///
  /// In en, this message translates to:
  /// **'My requests'**
  String get privacyRequests;

  /// No description provided for @privacyRequestsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No requests yet.'**
  String get privacyRequestsEmpty;

  /// No description provided for @privacyKindExport.
  ///
  /// In en, this message translates to:
  /// **'Copy of data'**
  String get privacyKindExport;

  /// No description provided for @privacyKindCorrection.
  ///
  /// In en, this message translates to:
  /// **'Correction'**
  String get privacyKindCorrection;

  /// No description provided for @privacyKindDeletion.
  ///
  /// In en, this message translates to:
  /// **'Deletion'**
  String get privacyKindDeletion;

  /// No description provided for @privacyStatusReceived.
  ///
  /// In en, this message translates to:
  /// **'Received'**
  String get privacyStatusReceived;

  /// No description provided for @privacyStatusInProgress.
  ///
  /// In en, this message translates to:
  /// **'In progress'**
  String get privacyStatusInProgress;

  /// No description provided for @privacyStatusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get privacyStatusCompleted;

  /// No description provided for @privacyStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Not accepted'**
  String get privacyStatusRejected;

  /// No description provided for @privacyDownload.
  ///
  /// In en, this message translates to:
  /// **'Download'**
  String get privacyDownload;

  /// No description provided for @privacyDownloadExpired.
  ///
  /// In en, this message translates to:
  /// **'Link ended — ask for a new copy'**
  String get privacyDownloadExpired;

  /// No description provided for @privacyOpenError.
  ///
  /// In en, this message translates to:
  /// **'Saved, but no app on this phone can open the file.'**
  String get privacyOpenError;

  /// No description provided for @privacySent.
  ///
  /// In en, this message translates to:
  /// **'Request sent. We will let you know.'**
  String get privacySent;

  /// No description provided for @shiftsTitle.
  ///
  /// In en, this message translates to:
  /// **'My shifts this week'**
  String get shiftsTitle;

  /// No description provided for @shiftsMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your work roster for the week'**
  String get shiftsMenuSubtitle;

  /// No description provided for @shiftsOff.
  ///
  /// In en, this message translates to:
  /// **'Day off'**
  String get shiftsOff;

  /// No description provided for @shiftsNone.
  ///
  /// In en, this message translates to:
  /// **'No shift yet'**
  String get shiftsNone;

  /// No description provided for @shiftsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Your employer has not made a roster for this week yet.'**
  String get shiftsEmpty;

  /// No description provided for @weekPrev.
  ///
  /// In en, this message translates to:
  /// **'Previous week'**
  String get weekPrev;

  /// No description provided for @weekNext.
  ///
  /// In en, this message translates to:
  /// **'Next week'**
  String get weekNext;

  /// No description provided for @weekOf.
  ///
  /// In en, this message translates to:
  /// **'Week from {date}'**
  String weekOf(String date);

  /// No description provided for @rosterTitle.
  ///
  /// In en, this message translates to:
  /// **'Shift roster'**
  String get rosterTitle;

  /// No description provided for @rosterMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Who works which shift this week'**
  String get rosterMenuSubtitle;

  /// No description provided for @rosterEmpty.
  ///
  /// In en, this message translates to:
  /// **'No workers to roster at this site.'**
  String get rosterEmpty;

  /// No description provided for @rosterTapHint.
  ///
  /// In en, this message translates to:
  /// **'Tap a box to change the shift.'**
  String get rosterTapHint;

  /// No description provided for @rosterClear.
  ///
  /// In en, this message translates to:
  /// **'No shift'**
  String get rosterClear;

  /// No description provided for @rosterOffShort.
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get rosterOffShort;

  /// No description provided for @inboxTitle.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get inboxTitle;

  /// No description provided for @inboxEmpty.
  ///
  /// In en, this message translates to:
  /// **'No notifications yet.'**
  String get inboxEmpty;

  /// No description provided for @inboxMarkAllRead.
  ///
  /// In en, this message translates to:
  /// **'Mark all as read'**
  String get inboxMarkAllRead;

  /// No description provided for @inboxUnread.
  ///
  /// In en, this message translates to:
  /// **'{count} unread'**
  String inboxUnread(String count);

  /// No description provided for @securityTitle.
  ///
  /// In en, this message translates to:
  /// **'Login & security'**
  String get securityTitle;

  /// No description provided for @securityMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Phones and browsers where you are logged in'**
  String get securityMenuSubtitle;

  /// No description provided for @securityIntro.
  ///
  /// In en, this message translates to:
  /// **'These devices are logged in to your KaamSathi account. If you don\'t recognise one, log it out.'**
  String get securityIntro;

  /// No description provided for @securityThisDevice.
  ///
  /// In en, this message translates to:
  /// **'This phone'**
  String get securityThisDevice;

  /// No description provided for @securityLastSeen.
  ///
  /// In en, this message translates to:
  /// **'Last used {date}'**
  String securityLastSeen(String date);

  /// No description provided for @securitySignedIn.
  ///
  /// In en, this message translates to:
  /// **'Logged in {date}'**
  String securitySignedIn(String date);

  /// No description provided for @securityRevoke.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get securityRevoke;

  /// No description provided for @securityRevokeConfirm.
  ///
  /// In en, this message translates to:
  /// **'Log out this device?'**
  String get securityRevokeConfirm;

  /// No description provided for @securityRevoked.
  ///
  /// In en, this message translates to:
  /// **'Device logged out.'**
  String get securityRevoked;

  /// No description provided for @securityRevokeOthers.
  ///
  /// In en, this message translates to:
  /// **'Log out all other devices'**
  String get securityRevokeOthers;

  /// No description provided for @securityRevokeOthersConfirm.
  ///
  /// In en, this message translates to:
  /// **'Log out every device except this phone?'**
  String get securityRevokeOthersConfirm;

  /// No description provided for @securityRevokedOthers.
  ///
  /// In en, this message translates to:
  /// **'Other devices logged out.'**
  String get securityRevokedOthers;

  /// No description provided for @securityPlatformAndroid.
  ///
  /// In en, this message translates to:
  /// **'Android phone'**
  String get securityPlatformAndroid;

  /// No description provided for @securityPlatformIos.
  ///
  /// In en, this message translates to:
  /// **'iPhone'**
  String get securityPlatformIos;

  /// No description provided for @securityPlatformWeb.
  ///
  /// In en, this message translates to:
  /// **'Web browser'**
  String get securityPlatformWeb;

  /// No description provided for @securityPlatformOther.
  ///
  /// In en, this message translates to:
  /// **'Other device'**
  String get securityPlatformOther;

  /// No description provided for @workHistTitle.
  ///
  /// In en, this message translates to:
  /// **'Past work (outside KaamSathi)'**
  String get workHistTitle;

  /// No description provided for @workHistMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Add jobs you did before, with a reference'**
  String get workHistMenuSubtitle;

  /// No description provided for @workHistIntro.
  ///
  /// In en, this message translates to:
  /// **'Add work you did before KaamSathi. When our team confirms it with your reference, it shows as verified on your Skill Passport.'**
  String get workHistIntro;

  /// No description provided for @workHistEmpty.
  ///
  /// In en, this message translates to:
  /// **'No past work added yet.'**
  String get workHistEmpty;

  /// No description provided for @workHistAdd.
  ///
  /// In en, this message translates to:
  /// **'Add past work'**
  String get workHistAdd;

  /// No description provided for @workHistEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit past work'**
  String get workHistEdit;

  /// No description provided for @workHistEmployer.
  ///
  /// In en, this message translates to:
  /// **'Employer / company name'**
  String get workHistEmployer;

  /// No description provided for @workHistRole.
  ///
  /// In en, this message translates to:
  /// **'Your role'**
  String get workHistRole;

  /// No description provided for @workHistTrade.
  ///
  /// In en, this message translates to:
  /// **'Trade'**
  String get workHistTrade;

  /// No description provided for @workHistStart.
  ///
  /// In en, this message translates to:
  /// **'Started'**
  String get workHistStart;

  /// No description provided for @workHistEnd.
  ///
  /// In en, this message translates to:
  /// **'Ended'**
  String get workHistEnd;

  /// No description provided for @workHistStillThere.
  ///
  /// In en, this message translates to:
  /// **'I still work here'**
  String get workHistStillThere;

  /// No description provided for @workHistDescription.
  ///
  /// In en, this message translates to:
  /// **'What did you do there?'**
  String get workHistDescription;

  /// No description provided for @workHistReference.
  ///
  /// In en, this message translates to:
  /// **'Reference (someone who can confirm)'**
  String get workHistReference;

  /// No description provided for @workHistRefName.
  ///
  /// In en, this message translates to:
  /// **'Reference name'**
  String get workHistRefName;

  /// No description provided for @workHistRefPhone.
  ///
  /// In en, this message translates to:
  /// **'Reference phone'**
  String get workHistRefPhone;

  /// No description provided for @workHistRefHint.
  ///
  /// In en, this message translates to:
  /// **'Our team may call this person to confirm your work. Tell them first.'**
  String get workHistRefHint;

  /// No description provided for @workHistRefBoth.
  ///
  /// In en, this message translates to:
  /// **'Fill in both the name and the phone of your reference.'**
  String get workHistRefBoth;

  /// No description provided for @workHistDocument.
  ///
  /// In en, this message translates to:
  /// **'Photo of a letter or work ID'**
  String get workHistDocument;

  /// No description provided for @workHistSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved. We will check it.'**
  String get workHistSaved;

  /// No description provided for @workHistDeleteConfirm.
  ///
  /// In en, this message translates to:
  /// **'Remove this past work?'**
  String get workHistDeleteConfirm;

  /// No description provided for @workHistDeleted.
  ///
  /// In en, this message translates to:
  /// **'Removed.'**
  String get workHistDeleted;

  /// No description provided for @workHistStatusSelf.
  ///
  /// In en, this message translates to:
  /// **'Self-reported'**
  String get workHistStatusSelf;

  /// No description provided for @workHistStatusRefPending.
  ///
  /// In en, this message translates to:
  /// **'Checking with reference'**
  String get workHistStatusRefPending;

  /// No description provided for @workHistStatusUnverifiable.
  ///
  /// In en, this message translates to:
  /// **'Could not confirm'**
  String get workHistStatusUnverifiable;

  /// No description provided for @workHistStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Not accepted'**
  String get workHistStatusRejected;

  /// No description provided for @workHistByReference.
  ///
  /// In en, this message translates to:
  /// **'Confirmed by reference'**
  String get workHistByReference;

  /// No description provided for @workHistByEmployer.
  ///
  /// In en, this message translates to:
  /// **'Confirmed by employer'**
  String get workHistByEmployer;

  /// No description provided for @workHistByDocument.
  ///
  /// In en, this message translates to:
  /// **'Confirmed by document'**
  String get workHistByDocument;

  /// No description provided for @workHistEndBeforeStart.
  ///
  /// In en, this message translates to:
  /// **'The end date must be after the start date.'**
  String get workHistEndBeforeStart;

  /// No description provided for @workHistLocked.
  ///
  /// In en, this message translates to:
  /// **'Verified work can\'t be changed.'**
  String get workHistLocked;

  /// No description provided for @jobsTitle.
  ///
  /// In en, this message translates to:
  /// **'Jobs for you'**
  String get jobsTitle;

  /// No description provided for @jobsMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Jobs that match your skills and areas'**
  String get jobsMenuSubtitle;

  /// No description provided for @jobsTabForYou.
  ///
  /// In en, this message translates to:
  /// **'For you'**
  String get jobsTabForYou;

  /// No description provided for @jobsTabApplications.
  ///
  /// In en, this message translates to:
  /// **'My applications'**
  String get jobsTabApplications;

  /// No description provided for @jobsReviewNote.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi\'s team reviews your interest before the employer sees you.'**
  String get jobsReviewNote;

  /// No description provided for @jobsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No matching jobs right now. Add your skills and preferred areas to see more.'**
  String get jobsEmpty;

  /// No description provided for @jobsUpdatePrefs.
  ///
  /// In en, this message translates to:
  /// **'Update my areas'**
  String get jobsUpdatePrefs;

  /// No description provided for @jobsInterested.
  ///
  /// In en, this message translates to:
  /// **'I\'m interested'**
  String get jobsInterested;

  /// No description provided for @jobsInterestConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Show interest in this job?'**
  String get jobsInterestConfirmTitle;

  /// No description provided for @jobsInterestSent.
  ///
  /// In en, this message translates to:
  /// **'Interest sent. We will let you know.'**
  String get jobsInterestSent;

  /// No description provided for @jobsInterestSentBadge.
  ///
  /// In en, this message translates to:
  /// **'Interest sent'**
  String get jobsInterestSentBadge;

  /// No description provided for @jobsFood.
  ///
  /// In en, this message translates to:
  /// **'Food provided'**
  String get jobsFood;

  /// No description provided for @jobsStay.
  ///
  /// In en, this message translates to:
  /// **'Stay provided'**
  String get jobsStay;

  /// No description provided for @jobsStarts.
  ///
  /// In en, this message translates to:
  /// **'Starts {date}'**
  String jobsStarts(String date);

  /// No description provided for @jobsOpenings.
  ///
  /// In en, this message translates to:
  /// **'{count} openings'**
  String jobsOpenings(String count);

  /// No description provided for @employerVerified.
  ///
  /// In en, this message translates to:
  /// **'Verified employer'**
  String get employerVerified;

  /// No description provided for @appsEmpty.
  ///
  /// In en, this message translates to:
  /// **'You have not applied to any job yet.'**
  String get appsEmpty;

  /// No description provided for @appsConfirmPrompt.
  ///
  /// In en, this message translates to:
  /// **'You were shortlisted. Are you still interested?'**
  String get appsConfirmPrompt;

  /// No description provided for @appsConfirm.
  ///
  /// In en, this message translates to:
  /// **'Yes, interested'**
  String get appsConfirm;

  /// No description provided for @appsDecline.
  ///
  /// In en, this message translates to:
  /// **'No, decline'**
  String get appsDecline;

  /// No description provided for @appsDeclineConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Decline this job?'**
  String get appsDeclineConfirmTitle;

  /// No description provided for @appsDeclineConfirmBody.
  ///
  /// In en, this message translates to:
  /// **'We will tell the employer you are not interested. This can\'t be undone.'**
  String get appsDeclineConfirmBody;

  /// No description provided for @appsDeclineReason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get appsDeclineReason;

  /// No description provided for @appsConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Thank you. We have told the employer.'**
  String get appsConfirmed;

  /// No description provided for @appsDeclined.
  ///
  /// In en, this message translates to:
  /// **'Declined.'**
  String get appsDeclined;

  /// No description provided for @appsResponseInterested.
  ///
  /// In en, this message translates to:
  /// **'You confirmed interest'**
  String get appsResponseInterested;

  /// No description provided for @appsResponseDeclined.
  ///
  /// In en, this message translates to:
  /// **'You declined'**
  String get appsResponseDeclined;

  /// No description provided for @appsInterview.
  ///
  /// In en, this message translates to:
  /// **'Interview: {date}'**
  String appsInterview(String date);

  /// No description provided for @appsUnderReview.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi is reviewing'**
  String get appsUnderReview;

  /// No description provided for @availTitle.
  ///
  /// In en, this message translates to:
  /// **'Availability & areas'**
  String get availTitle;

  /// No description provided for @availMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Where and when you can work, expected pay'**
  String get availMenuSubtitle;

  /// No description provided for @availAreas.
  ///
  /// In en, this message translates to:
  /// **'Preferred districts'**
  String get availAreas;

  /// No description provided for @availAreasHint.
  ///
  /// In en, this message translates to:
  /// **'Pick the districts where you are happy to work.'**
  String get availAreasHint;

  /// No description provided for @availAreasNone.
  ///
  /// In en, this message translates to:
  /// **'No districts chosen yet'**
  String get availAreasNone;

  /// No description provided for @availPickDistricts.
  ///
  /// In en, this message translates to:
  /// **'Choose districts'**
  String get availPickDistricts;

  /// No description provided for @availSearchDistrict.
  ///
  /// In en, this message translates to:
  /// **'Search district'**
  String get availSearchDistrict;

  /// No description provided for @availSelectedCount.
  ///
  /// In en, this message translates to:
  /// **'{count} selected'**
  String availSelectedCount(String count);

  /// No description provided for @availRadius.
  ///
  /// In en, this message translates to:
  /// **'How far can you travel for work?'**
  String get availRadius;

  /// No description provided for @availRadiusKm.
  ///
  /// In en, this message translates to:
  /// **'{km} km'**
  String availRadiusKm(String km);

  /// No description provided for @availRadiusAny.
  ///
  /// In en, this message translates to:
  /// **'Anywhere'**
  String get availRadiusAny;

  /// No description provided for @availWage.
  ///
  /// In en, this message translates to:
  /// **'Expected monthly salary (Rs.)'**
  String get availWage;

  /// No description provided for @availFrom.
  ///
  /// In en, this message translates to:
  /// **'Available from'**
  String get availFrom;

  /// No description provided for @availDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get availDone;

  /// No description provided for @availNumberInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a number.'**
  String get availNumberInvalid;

  /// No description provided for @supportTitle.
  ///
  /// In en, this message translates to:
  /// **'Help & support'**
  String get supportTitle;

  /// No description provided for @supportMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Ask our team for help'**
  String get supportMenuSubtitle;

  /// No description provided for @supportEmpty.
  ///
  /// In en, this message translates to:
  /// **'No help requests yet.'**
  String get supportEmpty;

  /// No description provided for @supportNew.
  ///
  /// In en, this message translates to:
  /// **'Ask for help'**
  String get supportNew;

  /// No description provided for @supportCategory.
  ///
  /// In en, this message translates to:
  /// **'What is it about?'**
  String get supportCategory;

  /// No description provided for @supportCatAccount.
  ///
  /// In en, this message translates to:
  /// **'Account / login'**
  String get supportCatAccount;

  /// No description provided for @supportCatPayment.
  ///
  /// In en, this message translates to:
  /// **'Salary / payment'**
  String get supportCatPayment;

  /// No description provided for @supportCatAttendance.
  ///
  /// In en, this message translates to:
  /// **'Hajiri (attendance)'**
  String get supportCatAttendance;

  /// No description provided for @supportCatJob.
  ///
  /// In en, this message translates to:
  /// **'Jobs'**
  String get supportCatJob;

  /// No description provided for @supportCatPrivacy.
  ///
  /// In en, this message translates to:
  /// **'Privacy'**
  String get supportCatPrivacy;

  /// No description provided for @supportCatTechnical.
  ///
  /// In en, this message translates to:
  /// **'Problem with the app'**
  String get supportCatTechnical;

  /// No description provided for @supportCatOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get supportCatOther;

  /// No description provided for @supportSubject.
  ///
  /// In en, this message translates to:
  /// **'Short title'**
  String get supportSubject;

  /// No description provided for @supportDescription.
  ///
  /// In en, this message translates to:
  /// **'Tell us what happened'**
  String get supportDescription;

  /// No description provided for @supportSent.
  ///
  /// In en, this message translates to:
  /// **'Sent. Our team will reply here.'**
  String get supportSent;

  /// No description provided for @supportStatusOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get supportStatusOpen;

  /// No description provided for @supportStatusPendingUser.
  ///
  /// In en, this message translates to:
  /// **'Waiting for your reply'**
  String get supportStatusPendingUser;

  /// No description provided for @supportStatusResolved.
  ///
  /// In en, this message translates to:
  /// **'Resolved'**
  String get supportStatusResolved;

  /// No description provided for @supportStatusClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get supportStatusClosed;

  /// No description provided for @supportReplyHint.
  ///
  /// In en, this message translates to:
  /// **'Write a message'**
  String get supportReplyHint;

  /// No description provided for @supportSend.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get supportSend;

  /// No description provided for @supportYou.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get supportYou;

  /// No description provided for @supportTeam.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi team'**
  String get supportTeam;

  /// No description provided for @supportNoMessages.
  ///
  /// In en, this message translates to:
  /// **'No replies yet. We usually answer within a day.'**
  String get supportNoMessages;

  /// No description provided for @supportClosedNote.
  ///
  /// In en, this message translates to:
  /// **'This request is closed. Ask again if you still need help.'**
  String get supportClosedNote;

  /// No description provided for @mobTitle.
  ///
  /// In en, this message translates to:
  /// **'Working abroad documents'**
  String get mobTitle;

  /// No description provided for @mobMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Passport, permits and clearances — shared only when you choose'**
  String get mobMenuSubtitle;

  /// No description provided for @mobIntro.
  ///
  /// In en, this message translates to:
  /// **'Keep your documents safe in one place and share them with a licensed agency you choose. KaamSathi does not find jobs abroad.'**
  String get mobIntro;

  /// No description provided for @mobSafetyTitle.
  ///
  /// In en, this message translates to:
  /// **'Stay safe'**
  String get mobSafetyTitle;

  /// No description provided for @mobSafety1.
  ///
  /// In en, this message translates to:
  /// **'Use only agencies licensed by the Department of Foreign Employment (DoFE).'**
  String get mobSafety1;

  /// No description provided for @mobSafety2.
  ///
  /// In en, this message translates to:
  /// **'Check the agency\'s licence yourself on the official DoFE website (dofe.gov.np) before you pay or sign anything.'**
  String get mobSafety2;

  /// No description provided for @mobSafety3.
  ///
  /// In en, this message translates to:
  /// **'Get a receipt for every payment. Never pay more than the government-approved fee.'**
  String get mobSafety3;

  /// No description provided for @mobSafety4.
  ///
  /// In en, this message translates to:
  /// **'Never hand over your original passport without a receipt.'**
  String get mobSafety4;

  /// No description provided for @mobTabDocuments.
  ///
  /// In en, this message translates to:
  /// **'My documents'**
  String get mobTabDocuments;

  /// No description provided for @mobTabAgencies.
  ///
  /// In en, this message translates to:
  /// **'Agencies & sharing'**
  String get mobTabAgencies;

  /// No description provided for @mobTravel.
  ///
  /// In en, this message translates to:
  /// **'Travel documents'**
  String get mobTravel;

  /// No description provided for @mobClearance.
  ///
  /// In en, this message translates to:
  /// **'Clearances & certificates'**
  String get mobClearance;

  /// No description provided for @mobEmpty.
  ///
  /// In en, this message translates to:
  /// **'No documents added yet.'**
  String get mobEmpty;

  /// No description provided for @mobAdd.
  ///
  /// In en, this message translates to:
  /// **'Add document'**
  String get mobAdd;

  /// No description provided for @mobKind.
  ///
  /// In en, this message translates to:
  /// **'Document type'**
  String get mobKind;

  /// No description provided for @mobKindPassport.
  ///
  /// In en, this message translates to:
  /// **'Passport'**
  String get mobKindPassport;

  /// No description provided for @mobKindLabourPermit.
  ///
  /// In en, this message translates to:
  /// **'Labour permit'**
  String get mobKindLabourPermit;

  /// No description provided for @mobKindVisa.
  ///
  /// In en, this message translates to:
  /// **'Visa'**
  String get mobKindVisa;

  /// No description provided for @mobKindPolice.
  ///
  /// In en, this message translates to:
  /// **'Police clearance'**
  String get mobKindPolice;

  /// No description provided for @mobKindMedical.
  ///
  /// In en, this message translates to:
  /// **'Medical fitness'**
  String get mobKindMedical;

  /// No description provided for @mobKindOrientation.
  ///
  /// In en, this message translates to:
  /// **'Pre-departure orientation'**
  String get mobKindOrientation;

  /// No description provided for @mobKindInsurance.
  ///
  /// In en, this message translates to:
  /// **'Insurance'**
  String get mobKindInsurance;

  /// No description provided for @mobKindLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language test'**
  String get mobKindLanguage;

  /// No description provided for @mobNumber.
  ///
  /// In en, this message translates to:
  /// **'Document number'**
  String get mobNumber;

  /// No description provided for @mobCountry.
  ///
  /// In en, this message translates to:
  /// **'Issuing country'**
  String get mobCountry;

  /// No description provided for @mobTitleField.
  ///
  /// In en, this message translates to:
  /// **'Name of the document'**
  String get mobTitleField;

  /// No description provided for @mobIssuer.
  ///
  /// In en, this message translates to:
  /// **'Issued by'**
  String get mobIssuer;

  /// No description provided for @mobScore.
  ///
  /// In en, this message translates to:
  /// **'Score or level'**
  String get mobScore;

  /// No description provided for @mobSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved. Our team will check it.'**
  String get mobSaved;

  /// No description provided for @mobDeleteConfirm.
  ///
  /// In en, this message translates to:
  /// **'Remove this document?'**
  String get mobDeleteConfirm;

  /// No description provided for @mobExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get mobExpired;

  /// No description provided for @mobExpiresInDays.
  ///
  /// In en, this message translates to:
  /// **'Expires in {days} days'**
  String mobExpiresInDays(String days);

  /// No description provided for @mobAgenciesIntro.
  ///
  /// In en, this message translates to:
  /// **'Only agencies with a valid DoFE licence that KaamSathi has checked are listed.'**
  String get mobAgenciesIntro;

  /// No description provided for @mobAgenciesEmpty.
  ///
  /// In en, this message translates to:
  /// **'No checked agencies yet.'**
  String get mobAgenciesEmpty;

  /// No description provided for @mobLicence.
  ///
  /// In en, this message translates to:
  /// **'Licence no. {number}'**
  String mobLicence(String number);

  /// No description provided for @mobLicenceValid.
  ///
  /// In en, this message translates to:
  /// **'Licence valid until {date}'**
  String mobLicenceValid(String date);

  /// No description provided for @mobShare.
  ///
  /// In en, this message translates to:
  /// **'Share my documents'**
  String get mobShare;

  /// No description provided for @mobShareTitle.
  ///
  /// In en, this message translates to:
  /// **'Share with {agency}?'**
  String mobShareTitle(String agency);

  /// No description provided for @mobShareBody.
  ///
  /// In en, this message translates to:
  /// **'The agency will see which documents you have, whether they are verified and when they expire. It will not see photos or full numbers. You can stop sharing at any time.'**
  String get mobShareBody;

  /// No description provided for @mobShareDays.
  ///
  /// In en, this message translates to:
  /// **'Share for'**
  String get mobShareDays;

  /// No description provided for @mobShared.
  ///
  /// In en, this message translates to:
  /// **'Shared. You can stop it at any time.'**
  String get mobShared;

  /// No description provided for @mobSharesTitle.
  ///
  /// In en, this message translates to:
  /// **'Who can see my documents'**
  String get mobSharesTitle;

  /// No description provided for @mobSharesEmpty.
  ///
  /// In en, this message translates to:
  /// **'You are not sharing with any agency.'**
  String get mobSharesEmpty;

  /// No description provided for @careerTitle.
  ///
  /// In en, this message translates to:
  /// **'Grow your earnings'**
  String get careerTitle;

  /// No description provided for @careerMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Certificates, courses and skills that pay more'**
  String get careerMenuSubtitle;

  /// No description provided for @careerEmpty.
  ///
  /// In en, this message translates to:
  /// **'No suggestions right now. Check again later.'**
  String get careerEmpty;

  /// No description provided for @careerUplift.
  ///
  /// In en, this message translates to:
  /// **'Up to {pct}% more pay'**
  String careerUplift(String pct);

  /// No description provided for @careerSeeAll.
  ///
  /// In en, this message translates to:
  /// **'See all'**
  String get careerSeeAll;

  /// No description provided for @careerKindCredential.
  ///
  /// In en, this message translates to:
  /// **'Certificate'**
  String get careerKindCredential;

  /// No description provided for @careerKindCourse.
  ///
  /// In en, this message translates to:
  /// **'Course'**
  String get careerKindCourse;

  /// No description provided for @careerKindSkill.
  ///
  /// In en, this message translates to:
  /// **'Skill'**
  String get careerKindSkill;

  /// No description provided for @careerKindProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get careerKindProfile;

  /// No description provided for @careerYourTrades.
  ///
  /// In en, this message translates to:
  /// **'Your trades'**
  String get careerYourTrades;

  /// No description provided for @careerEstimateNote.
  ///
  /// In en, this message translates to:
  /// **'Pay estimates come from wages on KaamSathi. They are not a promise.'**
  String get careerEstimateNote;

  /// No description provided for @tsTitle.
  ///
  /// In en, this message translates to:
  /// **'Timesheets'**
  String get tsTitle;

  /// No description provided for @tsMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Hours and overtime each week'**
  String get tsMenuSubtitle;

  /// No description provided for @tsSupMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Check and submit weekly hours'**
  String get tsSupMenuSubtitle;

  /// No description provided for @tsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No timesheet for this week yet.'**
  String get tsEmpty;

  /// No description provided for @tsSupEmpty.
  ///
  /// In en, this message translates to:
  /// **'No timesheets for this week. Prepare them from hajiri.'**
  String get tsSupEmpty;

  /// No description provided for @tsRegular.
  ///
  /// In en, this message translates to:
  /// **'Regular hours'**
  String get tsRegular;

  /// No description provided for @tsOtClaimed.
  ///
  /// In en, this message translates to:
  /// **'OT claimed'**
  String get tsOtClaimed;

  /// No description provided for @tsOtApproved.
  ///
  /// In en, this message translates to:
  /// **'OT approved'**
  String get tsOtApproved;

  /// No description provided for @tsHours.
  ///
  /// In en, this message translates to:
  /// **'{hours} h'**
  String tsHours(String hours);

  /// No description provided for @tsOtShort.
  ///
  /// In en, this message translates to:
  /// **'OT {hours} h'**
  String tsOtShort(String hours);

  /// No description provided for @tsStatusSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Submitted'**
  String get tsStatusSubmitted;

  /// No description provided for @tsStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Returned'**
  String get tsStatusRejected;

  /// No description provided for @tsOverCap.
  ///
  /// In en, this message translates to:
  /// **'Overtime is above the weekly limit of 24 hours.'**
  String get tsOverCap;

  /// No description provided for @tsNote.
  ///
  /// In en, this message translates to:
  /// **'Note'**
  String get tsNote;

  /// No description provided for @tsSubmitConfirm.
  ///
  /// In en, this message translates to:
  /// **'Submit this timesheet for approval?'**
  String get tsSubmitConfirm;

  /// No description provided for @tsSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Submitted for approval.'**
  String get tsSubmitted;

  /// No description provided for @tsSubmitAll.
  ///
  /// In en, this message translates to:
  /// **'Submit all drafts ({count})'**
  String tsSubmitAll(String count);

  /// No description provided for @tsSubmitAllConfirm.
  ///
  /// In en, this message translates to:
  /// **'Submit every draft timesheet for this week?'**
  String get tsSubmitAllConfirm;

  /// No description provided for @tsGenerate.
  ///
  /// In en, this message translates to:
  /// **'Prepare from hajiri'**
  String get tsGenerate;

  /// No description provided for @tsGenerated.
  ///
  /// In en, this message translates to:
  /// **'Timesheets prepared.'**
  String get tsGenerated;

  /// No description provided for @ecoGroupAbroad.
  ///
  /// In en, this message translates to:
  /// **'Working abroad'**
  String get ecoGroupAbroad;

  /// No description provided for @ecoGroupAccount.
  ///
  /// In en, this message translates to:
  /// **'Account & help'**
  String get ecoGroupAccount;

  /// No description provided for @availMaxDistricts.
  ///
  /// In en, this message translates to:
  /// **'You can choose up to {count} districts.'**
  String availMaxDistricts(String count);

  /// No description provided for @offersTab.
  ///
  /// In en, this message translates to:
  /// **'Offers'**
  String get offersTab;

  /// No description provided for @offerContractType.
  ///
  /// In en, this message translates to:
  /// **'Contract type'**
  String get offerContractType;

  /// No description provided for @offerContractPermanent.
  ///
  /// In en, this message translates to:
  /// **'Permanent'**
  String get offerContractPermanent;

  /// No description provided for @offerContractFixedTerm.
  ///
  /// In en, this message translates to:
  /// **'Fixed term'**
  String get offerContractFixedTerm;

  /// No description provided for @offerContractDaily.
  ///
  /// In en, this message translates to:
  /// **'Daily wage'**
  String get offerContractDaily;

  /// No description provided for @offerContractPartTime.
  ///
  /// In en, this message translates to:
  /// **'Part time'**
  String get offerContractPartTime;

  /// No description provided for @offerContractProbation.
  ///
  /// In en, this message translates to:
  /// **'Probation'**
  String get offerContractProbation;

  /// No description provided for @offerContractSeasonal.
  ///
  /// In en, this message translates to:
  /// **'Seasonal'**
  String get offerContractSeasonal;

  /// No description provided for @offerExpiresInDays.
  ///
  /// In en, this message translates to:
  /// **'Answer within {days} days'**
  String offerExpiresInDays(String days);

  /// No description provided for @offerExpiresInHours.
  ///
  /// In en, this message translates to:
  /// **'Answer within {hours} hours'**
  String offerExpiresInHours(String hours);

  /// No description provided for @offerExpired.
  ///
  /// In en, this message translates to:
  /// **'Offer expired'**
  String get offerExpired;

  /// No description provided for @offerStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Waiting for your answer'**
  String get offerStatusPending;

  /// No description provided for @offerStatusAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get offerStatusAccepted;

  /// No description provided for @offerStatusDeclined.
  ///
  /// In en, this message translates to:
  /// **'Declined'**
  String get offerStatusDeclined;

  /// No description provided for @offerStatusWithdrawn.
  ///
  /// In en, this message translates to:
  /// **'Withdrawn by employer'**
  String get offerStatusWithdrawn;

  /// No description provided for @offerReview.
  ///
  /// In en, this message translates to:
  /// **'Review and accept'**
  String get offerReview;

  /// No description provided for @offerDecline.
  ///
  /// In en, this message translates to:
  /// **'Decline'**
  String get offerDecline;

  /// No description provided for @offerDeclineTitle.
  ///
  /// In en, this message translates to:
  /// **'Decline this offer?'**
  String get offerDeclineTitle;

  /// No description provided for @offerDeclineBody.
  ///
  /// In en, this message translates to:
  /// **'We will tell the employer you said no. This can\'t be undone.'**
  String get offerDeclineBody;

  /// No description provided for @offerSummaryTitle.
  ///
  /// In en, this message translates to:
  /// **'Before you accept'**
  String get offerSummaryTitle;

  /// No description provided for @offerSummaryIntro.
  ///
  /// In en, this message translates to:
  /// **'Please check these details. This is what the employer is offering you.'**
  String get offerSummaryIntro;

  /// No description provided for @offerNoFee.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi never charges workers. Do not pay anyone to get this job.'**
  String get offerNoFee;

  /// No description provided for @offerAgree.
  ///
  /// In en, this message translates to:
  /// **'I have read these details and I want this job.'**
  String get offerAgree;

  /// No description provided for @offerAccept.
  ///
  /// In en, this message translates to:
  /// **'Accept offer'**
  String get offerAccept;

  /// No description provided for @offerAccepted.
  ///
  /// In en, this message translates to:
  /// **'Offer accepted. The employer will contact you.'**
  String get offerAccepted;

  /// No description provided for @offerAnswerBy.
  ///
  /// In en, this message translates to:
  /// **'Answer by {date}'**
  String offerAnswerBy(String date);

  /// No description provided for @alertsTitle.
  ///
  /// In en, this message translates to:
  /// **'Job alerts'**
  String get alertsTitle;

  /// No description provided for @alertsMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Get told when a matching job opens'**
  String get alertsMenuSubtitle;

  /// No description provided for @alertsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No job alerts yet.'**
  String get alertsEmpty;

  /// No description provided for @alertsAdd.
  ///
  /// In en, this message translates to:
  /// **'New alert'**
  String get alertsAdd;

  /// No description provided for @alertsEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit alert'**
  String get alertsEdit;

  /// No description provided for @alertsAnyTrade.
  ///
  /// In en, this message translates to:
  /// **'Any trade'**
  String get alertsAnyTrade;

  /// No description provided for @alertsAnyDistrict.
  ///
  /// In en, this message translates to:
  /// **'Any district'**
  String get alertsAnyDistrict;

  /// No description provided for @alertsMinWage.
  ///
  /// In en, this message translates to:
  /// **'Minimum monthly wage (Rs.)'**
  String get alertsMinWage;

  /// No description provided for @alertsFrom.
  ///
  /// In en, this message translates to:
  /// **'From {amount}'**
  String alertsFrom(String amount);

  /// No description provided for @alertsFrequency.
  ///
  /// In en, this message translates to:
  /// **'How often?'**
  String get alertsFrequency;

  /// No description provided for @freqInstant.
  ///
  /// In en, this message translates to:
  /// **'Right away'**
  String get freqInstant;

  /// No description provided for @freqDaily.
  ///
  /// In en, this message translates to:
  /// **'Once a day'**
  String get freqDaily;

  /// No description provided for @freqWeekly.
  ///
  /// In en, this message translates to:
  /// **'Once a week'**
  String get freqWeekly;

  /// No description provided for @alertsDeleteConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete this alert?'**
  String get alertsDeleteConfirm;

  /// No description provided for @alertsSaved.
  ///
  /// In en, this message translates to:
  /// **'Alert saved.'**
  String get alertsSaved;

  /// No description provided for @legalTitle.
  ///
  /// In en, this message translates to:
  /// **'Please review and accept'**
  String get legalTitle;

  /// No description provided for @legalIntro.
  ///
  /// In en, this message translates to:
  /// **'We have updated our terms. Please read them before you continue using KaamSathi.'**
  String get legalIntro;

  /// No description provided for @legalKindTerms.
  ///
  /// In en, this message translates to:
  /// **'Terms of use'**
  String get legalKindTerms;

  /// No description provided for @legalKindPrivacy.
  ///
  /// In en, this message translates to:
  /// **'Privacy policy'**
  String get legalKindPrivacy;

  /// No description provided for @legalKindOther.
  ///
  /// In en, this message translates to:
  /// **'Document'**
  String get legalKindOther;

  /// No description provided for @legalVersion.
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String legalVersion(String version);

  /// No description provided for @legalOpenHint.
  ///
  /// In en, this message translates to:
  /// **'Open this link in your phone\'s browser to read it:'**
  String get legalOpenHint;

  /// No description provided for @legalAgree.
  ///
  /// In en, this message translates to:
  /// **'I have read and accept these documents.'**
  String get legalAgree;

  /// No description provided for @legalAccept.
  ///
  /// In en, this message translates to:
  /// **'Accept and continue'**
  String get legalAccept;

  /// No description provided for @notifPrefsTitle.
  ///
  /// In en, this message translates to:
  /// **'Notification settings'**
  String get notifPrefsTitle;

  /// No description provided for @notifPrefsAlways.
  ///
  /// In en, this message translates to:
  /// **'Payslip, security and safety messages always come, whatever you choose here.'**
  String get notifPrefsAlways;

  /// No description provided for @notifSms.
  ///
  /// In en, this message translates to:
  /// **'SMS messages'**
  String get notifSms;

  /// No description provided for @notifPush.
  ///
  /// In en, this message translates to:
  /// **'App notifications'**
  String get notifPush;

  /// No description provided for @notifEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get notifEmail;

  /// No description provided for @notifMarketing.
  ///
  /// In en, this message translates to:
  /// **'News and offers from KaamSathi'**
  String get notifMarketing;

  /// No description provided for @notifJobAlertFreq.
  ///
  /// In en, this message translates to:
  /// **'Job alerts'**
  String get notifJobAlertFreq;

  /// No description provided for @notifQuietHours.
  ///
  /// In en, this message translates to:
  /// **'Quiet hours (no SMS at night)'**
  String get notifQuietHours;

  /// No description provided for @notifQuietFrom.
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get notifQuietFrom;

  /// No description provided for @notifQuietTo.
  ///
  /// In en, this message translates to:
  /// **'To'**
  String get notifQuietTo;

  /// No description provided for @notifQuietOff.
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get notifQuietOff;

  /// No description provided for @helpCenterTitle.
  ///
  /// In en, this message translates to:
  /// **'Help articles'**
  String get helpCenterTitle;

  /// No description provided for @helpCenterSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Quick answers to common questions'**
  String get helpCenterSubtitle;

  /// No description provided for @helpSearch.
  ///
  /// In en, this message translates to:
  /// **'Search help'**
  String get helpSearch;

  /// No description provided for @helpEmpty.
  ///
  /// In en, this message translates to:
  /// **'No articles found.'**
  String get helpEmpty;

  /// No description provided for @helpStillNeed.
  ///
  /// In en, this message translates to:
  /// **'Still need help? Ask our team.'**
  String get helpStillNeed;

  /// No description provided for @safetyTitle.
  ///
  /// In en, this message translates to:
  /// **'Report a safety problem'**
  String get safetyTitle;

  /// No description provided for @safetyMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Unsafe work, harassment or wages withheld — in confidence'**
  String get safetyMenuSubtitle;

  /// No description provided for @safetyDanger.
  ///
  /// In en, this message translates to:
  /// **'If you are in danger now, call 100 (Police).'**
  String get safetyDanger;

  /// No description provided for @safetyConfidential.
  ///
  /// In en, this message translates to:
  /// **'This report is confidential. Your employer will not see it. Only KaamSathi\'s safety team reads it.'**
  String get safetyConfidential;

  /// No description provided for @safetyKind.
  ///
  /// In en, this message translates to:
  /// **'What happened?'**
  String get safetyKind;

  /// No description provided for @safetyKindUnsafe.
  ///
  /// In en, this message translates to:
  /// **'Unsafe workplace'**
  String get safetyKindUnsafe;

  /// No description provided for @safetyKindHarassment.
  ///
  /// In en, this message translates to:
  /// **'Harassment or abuse'**
  String get safetyKindHarassment;

  /// No description provided for @safetyKindWages.
  ///
  /// In en, this message translates to:
  /// **'Wages withheld'**
  String get safetyKindWages;

  /// No description provided for @safetyKindOther.
  ///
  /// In en, this message translates to:
  /// **'Other safety concern'**
  String get safetyKindOther;

  /// No description provided for @safetyDescription.
  ///
  /// In en, this message translates to:
  /// **'Tell us what happened, where and when'**
  String get safetyDescription;

  /// No description provided for @safetyEmergency.
  ///
  /// In en, this message translates to:
  /// **'This is an emergency — call me now'**
  String get safetyEmergency;

  /// No description provided for @safetyEmergencyHint.
  ///
  /// In en, this message translates to:
  /// **'Our team will call you as soon as possible.'**
  String get safetyEmergencyHint;

  /// No description provided for @safetyAnonymous.
  ///
  /// In en, this message translates to:
  /// **'Hide my name if this is ever shared'**
  String get safetyAnonymous;

  /// No description provided for @safetySent.
  ///
  /// In en, this message translates to:
  /// **'Report sent. Our safety team will contact you.'**
  String get safetySent;

  /// No description provided for @supportCatSafety.
  ///
  /// In en, this message translates to:
  /// **'Safety'**
  String get supportCatSafety;

  /// No description provided for @offerEmployer.
  ///
  /// In en, this message translates to:
  /// **'Employer'**
  String get offerEmployer;

  /// No description provided for @offerStart.
  ///
  /// In en, this message translates to:
  /// **'Start date'**
  String get offerStart;

  /// No description provided for @offerAnswerByLabel.
  ///
  /// In en, this message translates to:
  /// **'Answer by'**
  String get offerAnswerByLabel;

  /// No description provided for @langTitle.
  ///
  /// In en, this message translates to:
  /// **'Languages I speak'**
  String get langTitle;

  /// No description provided for @langMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Employers look for workers who speak their customers\' language'**
  String get langMenuSubtitle;

  /// No description provided for @langAdd.
  ///
  /// In en, this message translates to:
  /// **'Add a language'**
  String get langAdd;

  /// No description provided for @langEmpty.
  ///
  /// In en, this message translates to:
  /// **'No languages added yet.'**
  String get langEmpty;

  /// No description provided for @langPick.
  ///
  /// In en, this message translates to:
  /// **'Choose a language'**
  String get langPick;

  /// No description provided for @langProficiency.
  ///
  /// In en, this message translates to:
  /// **'How well do you speak it?'**
  String get langProficiency;

  /// No description provided for @langSaved.
  ///
  /// In en, this message translates to:
  /// **'Languages saved.'**
  String get langSaved;

  /// No description provided for @langMax.
  ///
  /// In en, this message translates to:
  /// **'You can add up to 15 languages.'**
  String get langMax;

  /// No description provided for @profBasic.
  ///
  /// In en, this message translates to:
  /// **'Basic'**
  String get profBasic;

  /// No description provided for @profConversational.
  ///
  /// In en, this message translates to:
  /// **'Conversational'**
  String get profConversational;

  /// No description provided for @profFluent.
  ///
  /// In en, this message translates to:
  /// **'Fluent'**
  String get profFluent;

  /// No description provided for @profNative.
  ///
  /// In en, this message translates to:
  /// **'Native (mother tongue)'**
  String get profNative;

  /// No description provided for @langNameNe.
  ///
  /// In en, this message translates to:
  /// **'Nepali'**
  String get langNameNe;

  /// No description provided for @langNameEn.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get langNameEn;

  /// No description provided for @langNameHi.
  ///
  /// In en, this message translates to:
  /// **'Hindi'**
  String get langNameHi;

  /// No description provided for @langNameMai.
  ///
  /// In en, this message translates to:
  /// **'Maithili'**
  String get langNameMai;

  /// No description provided for @langNameBho.
  ///
  /// In en, this message translates to:
  /// **'Bhojpuri'**
  String get langNameBho;

  /// No description provided for @langNameNew.
  ///
  /// In en, this message translates to:
  /// **'Nepal Bhasa (Newari)'**
  String get langNameNew;

  /// No description provided for @langNameTha.
  ///
  /// In en, this message translates to:
  /// **'Tharu'**
  String get langNameTha;

  /// No description provided for @langNameTam.
  ///
  /// In en, this message translates to:
  /// **'Tamang'**
  String get langNameTam;

  /// No description provided for @langNameMgp.
  ///
  /// In en, this message translates to:
  /// **'Magar'**
  String get langNameMgp;

  /// No description provided for @langNameGvr.
  ///
  /// In en, this message translates to:
  /// **'Gurung'**
  String get langNameGvr;

  /// No description provided for @langNameLim.
  ///
  /// In en, this message translates to:
  /// **'Limbu'**
  String get langNameLim;

  /// No description provided for @langNameBap.
  ///
  /// In en, this message translates to:
  /// **'Rai (Bantawa)'**
  String get langNameBap;

  /// No description provided for @langNameXsr.
  ///
  /// In en, this message translates to:
  /// **'Sherpa'**
  String get langNameXsr;

  /// No description provided for @langNameDty.
  ///
  /// In en, this message translates to:
  /// **'Doteli'**
  String get langNameDty;

  /// No description provided for @langNameAwa.
  ///
  /// In en, this message translates to:
  /// **'Awadhi'**
  String get langNameAwa;

  /// No description provided for @langNameUr.
  ///
  /// In en, this message translates to:
  /// **'Urdu'**
  String get langNameUr;

  /// No description provided for @langNameAr.
  ///
  /// In en, this message translates to:
  /// **'Arabic'**
  String get langNameAr;

  /// No description provided for @langNameMs.
  ///
  /// In en, this message translates to:
  /// **'Malay'**
  String get langNameMs;

  /// No description provided for @langNameJa.
  ///
  /// In en, this message translates to:
  /// **'Japanese'**
  String get langNameJa;

  /// No description provided for @langNameKo.
  ///
  /// In en, this message translates to:
  /// **'Korean'**
  String get langNameKo;

  /// No description provided for @langNameZh.
  ///
  /// In en, this message translates to:
  /// **'Chinese'**
  String get langNameZh;

  /// No description provided for @complTitle.
  ///
  /// In en, this message translates to:
  /// **'Complete your profile'**
  String get complTitle;

  /// No description provided for @complPercent.
  ///
  /// In en, this message translates to:
  /// **'{percent} complete'**
  String complPercent(String percent);

  /// No description provided for @complHint.
  ///
  /// In en, this message translates to:
  /// **'A complete profile gets more job offers.'**
  String get complHint;

  /// No description provided for @complPhoto.
  ///
  /// In en, this message translates to:
  /// **'Add a profile photo'**
  String get complPhoto;

  /// No description provided for @complIdentity.
  ///
  /// In en, this message translates to:
  /// **'Add your citizenship or national ID'**
  String get complIdentity;

  /// No description provided for @complSkills.
  ///
  /// In en, this message translates to:
  /// **'Add at least one skill'**
  String get complSkills;

  /// No description provided for @complLanguages.
  ///
  /// In en, this message translates to:
  /// **'Add the languages you speak'**
  String get complLanguages;

  /// No description provided for @complAvailability.
  ///
  /// In en, this message translates to:
  /// **'Set your availability and expected wage'**
  String get complAvailability;

  /// No description provided for @complVerifiedCredential.
  ///
  /// In en, this message translates to:
  /// **'Get a certificate verified'**
  String get complVerifiedCredential;

  /// No description provided for @complWorkHistory.
  ///
  /// In en, this message translates to:
  /// **'Add your work history'**
  String get complWorkHistory;

  /// No description provided for @complPaymentDetails.
  ///
  /// In en, this message translates to:
  /// **'Add bank or wallet details for salary'**
  String get complPaymentDetails;

  /// No description provided for @appsInvited.
  ///
  /// In en, this message translates to:
  /// **'Invited by employer'**
  String get appsInvited;

  /// No description provided for @appsInvitedHint.
  ///
  /// In en, this message translates to:
  /// **'This employer worked with you before and invited you to apply.'**
  String get appsInvitedHint;

  /// No description provided for @ivTitle.
  ///
  /// In en, this message translates to:
  /// **'Interviews'**
  String get ivTitle;

  /// No description provided for @ivModeInPerson.
  ///
  /// In en, this message translates to:
  /// **'In person'**
  String get ivModeInPerson;

  /// No description provided for @ivModePhone.
  ///
  /// In en, this message translates to:
  /// **'Phone call'**
  String get ivModePhone;

  /// No description provided for @ivModeVideo.
  ///
  /// In en, this message translates to:
  /// **'Video call'**
  String get ivModeVideo;

  /// No description provided for @ivModeTradeTest.
  ///
  /// In en, this message translates to:
  /// **'Skill test'**
  String get ivModeTradeTest;

  /// No description provided for @ivOutcomePending.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get ivOutcomePending;

  /// No description provided for @ivOutcomePassed.
  ///
  /// In en, this message translates to:
  /// **'Passed'**
  String get ivOutcomePassed;

  /// No description provided for @ivOutcomeFailed.
  ///
  /// In en, this message translates to:
  /// **'Not selected'**
  String get ivOutcomeFailed;

  /// No description provided for @ivOutcomeNoShow.
  ///
  /// In en, this message translates to:
  /// **'Missed'**
  String get ivOutcomeNoShow;

  /// No description provided for @ivWith.
  ///
  /// In en, this message translates to:
  /// **'With {name}'**
  String ivWith(String name);

  /// No description provided for @ivPlace.
  ///
  /// In en, this message translates to:
  /// **'Place: {place}'**
  String ivPlace(String place);

  /// No description provided for @ratingsTitle.
  ///
  /// In en, this message translates to:
  /// **'My ratings'**
  String get ratingsTitle;

  /// No description provided for @ratingsMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'What employers said about you, and what you said'**
  String get ratingsMenuSubtitle;

  /// No description provided for @ratingsReceived.
  ///
  /// In en, this message translates to:
  /// **'From employers'**
  String get ratingsReceived;

  /// No description provided for @ratingsGiven.
  ///
  /// In en, this message translates to:
  /// **'Given by me'**
  String get ratingsGiven;

  /// No description provided for @ratingsEmptyReceived.
  ///
  /// In en, this message translates to:
  /// **'No employer has rated you yet.'**
  String get ratingsEmptyReceived;

  /// No description provided for @ratingsEmptyGiven.
  ///
  /// In en, this message translates to:
  /// **'You have not rated any employer yet.'**
  String get ratingsEmptyGiven;

  /// No description provided for @ratingsAverage.
  ///
  /// In en, this message translates to:
  /// **'Average {score} · {count} ratings'**
  String ratingsAverage(String score, String count);

  /// No description provided for @ratingsReliability.
  ///
  /// In en, this message translates to:
  /// **'Reliability'**
  String get ratingsReliability;

  /// No description provided for @ratingsSkill.
  ///
  /// In en, this message translates to:
  /// **'Skill'**
  String get ratingsSkill;

  /// No description provided for @ratingsFlag.
  ///
  /// In en, this message translates to:
  /// **'Report this comment'**
  String get ratingsFlag;

  /// No description provided for @ratingsFlagTitle.
  ///
  /// In en, this message translates to:
  /// **'Report this comment?'**
  String get ratingsFlagTitle;

  /// No description provided for @ratingsFlagHint.
  ///
  /// In en, this message translates to:
  /// **'Tell us why it is unfair or untrue. KaamSathi\'s team will review it; your score stays the same until then.'**
  String get ratingsFlagHint;

  /// No description provided for @ratingsFlagReason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get ratingsFlagReason;

  /// No description provided for @ratingsFlagged.
  ///
  /// In en, this message translates to:
  /// **'Sent for review.'**
  String get ratingsFlagged;

  /// No description provided for @ratingsStatusFlagged.
  ///
  /// In en, this message translates to:
  /// **'Under review'**
  String get ratingsStatusFlagged;

  /// No description provided for @ratingsStatusHidden.
  ///
  /// In en, this message translates to:
  /// **'Comment hidden by KaamSathi'**
  String get ratingsStatusHidden;

  /// No description provided for @ratingsVoided.
  ///
  /// In en, this message translates to:
  /// **'Not counted'**
  String get ratingsVoided;

  /// No description provided for @disputeStatusAppealed.
  ///
  /// In en, this message translates to:
  /// **'Appealed'**
  String get disputeStatusAppealed;

  /// No description provided for @disputeStatusAppealResolved.
  ///
  /// In en, this message translates to:
  /// **'Appeal decided'**
  String get disputeStatusAppealResolved;

  /// No description provided for @disputeDetailTitle.
  ///
  /// In en, this message translates to:
  /// **'Complaint'**
  String get disputeDetailTitle;

  /// No description provided for @evidenceTitle.
  ///
  /// In en, this message translates to:
  /// **'Evidence'**
  String get evidenceTitle;

  /// No description provided for @evidenceEmpty.
  ///
  /// In en, this message translates to:
  /// **'No evidence added yet.'**
  String get evidenceEmpty;

  /// No description provided for @evidenceHint.
  ///
  /// In en, this message translates to:
  /// **'Photos of payslips, receipts or the site help our team decide. Up to 10 files, 10 MB each.'**
  String get evidenceHint;

  /// No description provided for @evidenceAdd.
  ///
  /// In en, this message translates to:
  /// **'Add evidence'**
  String get evidenceAdd;

  /// No description provided for @evidenceNote.
  ///
  /// In en, this message translates to:
  /// **'Note'**
  String get evidenceNote;

  /// No description provided for @evidenceUpload.
  ///
  /// In en, this message translates to:
  /// **'Upload'**
  String get evidenceUpload;

  /// No description provided for @evidenceUploaded.
  ///
  /// In en, this message translates to:
  /// **'Evidence added.'**
  String get evidenceUploaded;

  /// No description provided for @evidenceTooBig.
  ///
  /// In en, this message translates to:
  /// **'This file is too large (max 10 MB).'**
  String get evidenceTooBig;

  /// No description provided for @evidencePhoto.
  ///
  /// In en, this message translates to:
  /// **'Photo'**
  String get evidencePhoto;

  /// No description provided for @evidencePdf.
  ///
  /// In en, this message translates to:
  /// **'PDF document'**
  String get evidencePdf;

  /// No description provided for @evidenceCount.
  ///
  /// In en, this message translates to:
  /// **'{count} files'**
  String evidenceCount(String count);

  /// No description provided for @appealButton.
  ///
  /// In en, this message translates to:
  /// **'Appeal this decision'**
  String get appealButton;

  /// No description provided for @appealUntil.
  ///
  /// In en, this message translates to:
  /// **'You can appeal until {date}.'**
  String appealUntil(String date);

  /// No description provided for @appealReason.
  ///
  /// In en, this message translates to:
  /// **'Why do you disagree?'**
  String get appealReason;

  /// No description provided for @appealHint.
  ///
  /// In en, this message translates to:
  /// **'You can appeal only once. A different KaamSathi staff member reviews it within 7 days.'**
  String get appealHint;

  /// No description provided for @appealSent.
  ///
  /// In en, this message translates to:
  /// **'Appeal sent.'**
  String get appealSent;

  /// No description provided for @appealSection.
  ///
  /// In en, this message translates to:
  /// **'Appeal'**
  String get appealSection;

  /// No description provided for @appealWaiting.
  ///
  /// In en, this message translates to:
  /// **'Waiting for review'**
  String get appealWaiting;

  /// No description provided for @appealUpheld.
  ///
  /// In en, this message translates to:
  /// **'Decision upheld'**
  String get appealUpheld;

  /// No description provided for @appealOverturned.
  ///
  /// In en, this message translates to:
  /// **'Decision overturned'**
  String get appealOverturned;

  /// No description provided for @credResubmit.
  ///
  /// In en, this message translates to:
  /// **'Resubmit'**
  String get credResubmit;

  /// No description provided for @credResubmitTitle.
  ///
  /// In en, this message translates to:
  /// **'Resubmit certificate'**
  String get credResubmitTitle;

  /// No description provided for @credResubmitHint.
  ///
  /// In en, this message translates to:
  /// **'Fix what was wrong. Anything you leave unchanged — including the photo — is copied from the rejected one.'**
  String get credResubmitHint;

  /// No description provided for @credResubmissionOf.
  ///
  /// In en, this message translates to:
  /// **'Resubmitted after a rejection'**
  String get credResubmissionOf;

  /// No description provided for @credResubmitted.
  ///
  /// In en, this message translates to:
  /// **'Sent again for checking.'**
  String get credResubmitted;

  /// No description provided for @credEarlierNote.
  ///
  /// In en, this message translates to:
  /// **'Earlier reason: {note}'**
  String credEarlierNote(String note);

  /// No description provided for @corrTitle.
  ///
  /// In en, this message translates to:
  /// **'Correction requests'**
  String get corrTitle;

  /// No description provided for @corrMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Ask to fix a wrong hajiri day'**
  String get corrMenuSubtitle;

  /// No description provided for @corrRequest.
  ///
  /// In en, this message translates to:
  /// **'Request a correction'**
  String get corrRequest;

  /// No description provided for @corrFor.
  ///
  /// In en, this message translates to:
  /// **'Hajiri for {date}'**
  String corrFor(String date);

  /// No description provided for @corrRecorded.
  ///
  /// In en, this message translates to:
  /// **'Recorded: {status}'**
  String corrRecorded(String status);

  /// No description provided for @corrShouldBe.
  ///
  /// In en, this message translates to:
  /// **'It should be'**
  String get corrShouldBe;

  /// No description provided for @corrCheckIn.
  ///
  /// In en, this message translates to:
  /// **'Arrival time'**
  String get corrCheckIn;

  /// No description provided for @corrCheckOut.
  ///
  /// In en, this message translates to:
  /// **'Leaving time'**
  String get corrCheckOut;

  /// No description provided for @corrReason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get corrReason;

  /// No description provided for @corrReasonHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. I was at the site but the QR did not scan'**
  String get corrReasonHint;

  /// No description provided for @corrSent.
  ///
  /// In en, this message translates to:
  /// **'Request sent to your supervisor.'**
  String get corrSent;

  /// No description provided for @corrEmpty.
  ///
  /// In en, this message translates to:
  /// **'No correction requests.'**
  String get corrEmpty;

  /// No description provided for @corrStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Waiting'**
  String get corrStatusPending;

  /// No description provided for @corrStatusApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get corrStatusApproved;

  /// No description provided for @corrStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get corrStatusRejected;

  /// No description provided for @corrJob.
  ///
  /// In en, this message translates to:
  /// **'Job'**
  String get corrJob;

  /// No description provided for @corrNoJob.
  ///
  /// In en, this message translates to:
  /// **'You need an active job to request a correction.'**
  String get corrNoJob;

  /// No description provided for @corrNote.
  ///
  /// In en, this message translates to:
  /// **'Note: {note}'**
  String corrNote(String note);

  /// No description provided for @corrChange.
  ///
  /// In en, this message translates to:
  /// **'{from} → {to}'**
  String corrChange(String from, String to);

  /// No description provided for @corrQueueTitle.
  ///
  /// In en, this message translates to:
  /// **'Hajiri corrections'**
  String get corrQueueTitle;

  /// No description provided for @corrQueueSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Workers asking to fix their hajiri'**
  String get corrQueueSubtitle;

  /// No description provided for @corrTabPending.
  ///
  /// In en, this message translates to:
  /// **'Waiting'**
  String get corrTabPending;

  /// No description provided for @corrTabDecided.
  ///
  /// In en, this message translates to:
  /// **'Decided'**
  String get corrTabDecided;

  /// No description provided for @corrApprove.
  ///
  /// In en, this message translates to:
  /// **'Approve'**
  String get corrApprove;

  /// No description provided for @corrReject.
  ///
  /// In en, this message translates to:
  /// **'Reject'**
  String get corrReject;

  /// No description provided for @corrApproveTitle.
  ///
  /// In en, this message translates to:
  /// **'Approve this correction?'**
  String get corrApproveTitle;

  /// No description provided for @corrRejectTitle.
  ///
  /// In en, this message translates to:
  /// **'Reject this correction?'**
  String get corrRejectTitle;

  /// No description provided for @corrApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved. Hajiri updated.'**
  String get corrApproved;

  /// No description provided for @corrRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected. The worker has been told.'**
  String get corrRejected;

  /// No description provided for @corrNoteLabel.
  ///
  /// In en, this message translates to:
  /// **'Note'**
  String get corrNoteLabel;

  /// No description provided for @corrRejectNote.
  ///
  /// In en, this message translates to:
  /// **'Tell the worker why'**
  String get corrRejectNote;

  /// No description provided for @talabRegularHours.
  ///
  /// In en, this message translates to:
  /// **'Regular hours'**
  String get talabRegularHours;

  /// No description provided for @talabHourlyWage.
  ///
  /// In en, this message translates to:
  /// **'Hourly wage'**
  String get talabHourlyWage;

  /// No description provided for @empWageHourly.
  ///
  /// In en, this message translates to:
  /// **'{amount} per hour'**
  String empWageHourly(String amount);

  /// No description provided for @empWorkType.
  ///
  /// In en, this message translates to:
  /// **'Work type'**
  String get empWorkType;

  /// No description provided for @empPartTime.
  ///
  /// In en, this message translates to:
  /// **'Part-time'**
  String get empPartTime;

  /// No description provided for @empFullTime.
  ///
  /// In en, this message translates to:
  /// **'Full-time'**
  String get empFullTime;

  /// No description provided for @rosterNotified.
  ///
  /// In en, this message translates to:
  /// **'Saved · {count} workers notified'**
  String rosterNotified(String count);

  /// No description provided for @rosterWarnOnLeave.
  ///
  /// In en, this message translates to:
  /// **'On leave'**
  String get rosterWarnOnLeave;

  /// No description provided for @rosterWarnHoliday.
  ///
  /// In en, this message translates to:
  /// **'Public holiday'**
  String get rosterWarnHoliday;

  /// No description provided for @rosterWarnWeeklyOff.
  ///
  /// In en, this message translates to:
  /// **'Weekly day off'**
  String get rosterWarnWeeklyOff;

  /// No description provided for @rosterWarnConflict.
  ///
  /// In en, this message translates to:
  /// **'Rostered at another workplace'**
  String get rosterWarnConflict;

  /// No description provided for @rosterWarnLegend.
  ///
  /// In en, this message translates to:
  /// **'! = check this day'**
  String get rosterWarnLegend;

  /// No description provided for @commonEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get commonEdit;

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navJobsTab.
  ///
  /// In en, this message translates to:
  /// **'Jobs'**
  String get navJobsTab;

  /// No description provided for @navWork.
  ///
  /// In en, this message translates to:
  /// **'Work'**
  String get navWork;

  /// No description provided for @navLearn.
  ///
  /// In en, this message translates to:
  /// **'Learn'**
  String get navLearn;

  /// No description provided for @workTitle.
  ///
  /// In en, this message translates to:
  /// **'Work'**
  String get workTitle;

  /// No description provided for @workHajiri.
  ///
  /// In en, this message translates to:
  /// **'Hajiri'**
  String get workHajiri;

  /// No description provided for @workPayslips.
  ///
  /// In en, this message translates to:
  /// **'Payslips'**
  String get workPayslips;

  /// No description provided for @learnTitle.
  ///
  /// In en, this message translates to:
  /// **'Learn'**
  String get learnTitle;

  /// No description provided for @learnHeadline.
  ///
  /// In en, this message translates to:
  /// **'Get better at your trade'**
  String get learnHeadline;

  /// No description provided for @learnIntro.
  ///
  /// In en, this message translates to:
  /// **'Courses near you, your certificates and the next step in your trade.'**
  String get learnIntro;

  /// No description provided for @learnMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Training, certificates, next steps'**
  String get learnMenuSubtitle;

  /// No description provided for @slotLearnWorkshopAlt.
  ///
  /// In en, this message translates to:
  /// **'Training at a workshop bench'**
  String get slotLearnWorkshopAlt;

  /// No description provided for @slotCareerStepAlt.
  ///
  /// In en, this message translates to:
  /// **'A worker moving up a trade level'**
  String get slotCareerStepAlt;

  /// No description provided for @slotLearnWorkshopIllustrationAlt.
  ///
  /// In en, this message translates to:
  /// **'Illustration: a trainee at a wiring practice board'**
  String get slotLearnWorkshopIllustrationAlt;

  /// No description provided for @slotCareerStepIllustrationAlt.
  ///
  /// In en, this message translates to:
  /// **'Illustration: a welder lifting her helmet after a test weld'**
  String get slotCareerStepIllustrationAlt;

  /// No description provided for @homeHello.
  ///
  /// In en, this message translates to:
  /// **'Namaste,'**
  String get homeHello;

  /// No description provided for @homeLadderChip.
  ///
  /// In en, this message translates to:
  /// **'Skill ladder: level {level}'**
  String homeLadderChip(String level);

  /// No description provided for @homeDaysWorked.
  ///
  /// In en, this message translates to:
  /// **'days worked'**
  String get homeDaysWorked;

  /// No description provided for @homeOutOf100.
  ///
  /// In en, this message translates to:
  /// **'out of 100'**
  String get homeOutOf100;

  /// No description provided for @homeScoreSoon.
  ///
  /// In en, this message translates to:
  /// **'after your first job'**
  String get homeScoreSoon;

  /// No description provided for @homeSeeAll.
  ///
  /// In en, this message translates to:
  /// **'See all'**
  String get homeSeeAll;

  /// No description provided for @homeNoJobs.
  ///
  /// In en, this message translates to:
  /// **'No matching jobs right now. Adding more work areas shows more jobs.'**
  String get homeNoJobs;

  /// No description provided for @jobsMatchSkillArea.
  ///
  /// In en, this message translates to:
  /// **'Matches your skills and area'**
  String get jobsMatchSkillArea;

  /// No description provided for @jobsMatchTradeArea.
  ///
  /// In en, this message translates to:
  /// **'Matches your skill ({trade}) and area'**
  String jobsMatchTradeArea(String trade);

  /// No description provided for @ladderTitle.
  ///
  /// In en, this message translates to:
  /// **'Skill ladder'**
  String get ladderTitle;

  /// No description provided for @ladderRungPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get ladderRungPhone;

  /// No description provided for @ladderRungIdentity.
  ///
  /// In en, this message translates to:
  /// **'Identity'**
  String get ladderRungIdentity;

  /// No description provided for @ladderRungWork.
  ///
  /// In en, this message translates to:
  /// **'Work'**
  String get ladderRungWork;

  /// No description provided for @ladderRungCertificate.
  ///
  /// In en, this message translates to:
  /// **'Certificate'**
  String get ladderRungCertificate;

  /// No description provided for @ladderRungTrusted.
  ///
  /// In en, this message translates to:
  /// **'Highly trusted'**
  String get ladderRungTrusted;

  /// No description provided for @ladderSummary.
  ///
  /// In en, this message translates to:
  /// **'Skill ladder: {done} of {total} steps'**
  String ladderSummary(String done, String total);

  /// No description provided for @ladderStepDone.
  ///
  /// In en, this message translates to:
  /// **'{step}: done'**
  String ladderStepDone(String step);

  /// No description provided for @ladderStepOpen.
  ///
  /// In en, this message translates to:
  /// **'{step}: not yet'**
  String ladderStepOpen(String step);

  /// No description provided for @ladderNext.
  ///
  /// In en, this message translates to:
  /// **'Next step: {step}'**
  String ladderNext(String step);

  /// No description provided for @ladderChipShort.
  ///
  /// In en, this message translates to:
  /// **'Ladder {done}/{total}'**
  String ladderChipShort(String done, String total);

  /// No description provided for @passportShare.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get passportShare;

  /// No description provided for @passportPrivacyNote.
  ///
  /// In en, this message translates to:
  /// **'ID numbers are never shown. You choose who sees this.'**
  String get passportPrivacyNote;

  /// No description provided for @passportPhotoMissing.
  ///
  /// In en, this message translates to:
  /// **'No photo yet'**
  String get passportPhotoMissing;

  /// No description provided for @ppTimeline.
  ///
  /// In en, this message translates to:
  /// **'Verified skills and certificates'**
  String get ppTimeline;

  /// No description provided for @ppTimelineEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing verified yet. Add a certificate from Learn.'**
  String get ppTimelineEmpty;

  /// No description provided for @celebrateCredential.
  ///
  /// In en, this message translates to:
  /// **'Your first certificate is verified.'**
  String get celebrateCredential;

  /// No description provided for @celebratePlacement.
  ///
  /// In en, this message translates to:
  /// **'You have joined your new job. All the best.'**
  String get celebratePlacement;

  /// No description provided for @celebrateProfile.
  ///
  /// In en, this message translates to:
  /// **'Your profile is complete.'**
  String get celebrateProfile;

  /// No description provided for @celebrateTraining.
  ///
  /// In en, this message translates to:
  /// **'Training completed. Well done.'**
  String get celebrateTraining;

  /// No description provided for @blStatusRequested.
  ///
  /// In en, this message translates to:
  /// **'Waiting for reply'**
  String get blStatusRequested;

  /// No description provided for @blStatusAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get blStatusAccepted;

  /// No description provided for @blStatusDeclined.
  ///
  /// In en, this message translates to:
  /// **'Declined'**
  String get blStatusDeclined;

  /// No description provided for @blStatusExpired.
  ///
  /// In en, this message translates to:
  /// **'No reply in time'**
  String get blStatusExpired;

  /// No description provided for @blStatusOnTheWay.
  ///
  /// In en, this message translates to:
  /// **'On the way'**
  String get blStatusOnTheWay;

  /// No description provided for @blStatusArrived.
  ///
  /// In en, this message translates to:
  /// **'Arrived'**
  String get blStatusArrived;

  /// No description provided for @blStatusInProgress.
  ///
  /// In en, this message translates to:
  /// **'Work started'**
  String get blStatusInProgress;

  /// No description provided for @blStatusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Work done'**
  String get blStatusCompleted;

  /// No description provided for @blStatusConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get blStatusConfirmed;

  /// No description provided for @blStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get blStatusCancelled;

  /// No description provided for @blStatusNoShow.
  ///
  /// In en, this message translates to:
  /// **'Did not come'**
  String get blStatusNoShow;

  /// No description provided for @blStatusDisputed.
  ///
  /// In en, this message translates to:
  /// **'Under review'**
  String get blStatusDisputed;

  /// No description provided for @blPriceFixed.
  ///
  /// In en, this message translates to:
  /// **'Fixed price'**
  String get blPriceFixed;

  /// No description provided for @blPriceHourly.
  ///
  /// In en, this message translates to:
  /// **'By the hour'**
  String get blPriceHourly;

  /// No description provided for @blPriceVisitQuote.
  ///
  /// In en, this message translates to:
  /// **'Visit, then quote'**
  String get blPriceVisitQuote;

  /// No description provided for @blPerHour.
  ///
  /// In en, this message translates to:
  /// **'{amount} an hour'**
  String blPerHour(String amount);

  /// No description provided for @blFixedPrice.
  ///
  /// In en, this message translates to:
  /// **'{amount} fixed'**
  String blFixedPrice(String amount);

  /// No description provided for @blVisitThenQuote.
  ///
  /// In en, this message translates to:
  /// **'Visit {amount}, then a quote'**
  String blVisitThenQuote(String amount);

  /// No description provided for @blNewOnBolau.
  ///
  /// In en, this message translates to:
  /// **'New on Bolau'**
  String get blNewOnBolau;

  /// No description provided for @blJobsDone.
  ///
  /// In en, this message translates to:
  /// **'{count} jobs done'**
  String blJobsDone(String count);

  /// No description provided for @blRatingA11y.
  ///
  /// In en, this message translates to:
  /// **'Rated {rating} out of 5'**
  String blRatingA11y(String rating);

  /// No description provided for @blIdVerified.
  ///
  /// In en, this message translates to:
  /// **'ID verified'**
  String get blIdVerified;

  /// No description provided for @blInstant.
  ///
  /// In en, this message translates to:
  /// **'Instant booking'**
  String get blInstant;

  /// No description provided for @blFromPrice.
  ///
  /// In en, this message translates to:
  /// **'From {amount}'**
  String blFromPrice(String amount);

  /// No description provided for @blNextFree.
  ///
  /// In en, this message translates to:
  /// **'Free {when}'**
  String blNextFree(String when);

  /// No description provided for @blArrivalCode.
  ///
  /// In en, this message translates to:
  /// **'Arrival code'**
  String get blArrivalCode;

  /// No description provided for @blArrivalCodeA11y.
  ///
  /// In en, this message translates to:
  /// **'Arrival code {digits}'**
  String blArrivalCodeA11y(String digits);

  /// No description provided for @blArrivalCodeHint.
  ///
  /// In en, this message translates to:
  /// **'Read this out when the Sipalu arrives at your door. Don\'t share it before.'**
  String get blArrivalCodeHint;

  /// No description provided for @blEnterArrivalCode.
  ///
  /// In en, this message translates to:
  /// **'Arrival code'**
  String get blEnterArrivalCode;

  /// No description provided for @blEnterArrivalCodeHint.
  ///
  /// In en, this message translates to:
  /// **'Ask the Ghardhani for the 4-digit code when you reach the door.'**
  String get blEnterArrivalCodeHint;

  /// No description provided for @blIHaveArrived.
  ///
  /// In en, this message translates to:
  /// **'I have arrived'**
  String get blIHaveArrived;

  /// No description provided for @blNow.
  ///
  /// In en, this message translates to:
  /// **'now'**
  String get blNow;

  /// No description provided for @blRequestTimeUp.
  ///
  /// In en, this message translates to:
  /// **'Time is up'**
  String get blRequestTimeUp;

  /// No description provided for @blAnswerWithin.
  ///
  /// In en, this message translates to:
  /// **'Answer within {time}'**
  String blAnswerWithin(String time);

  /// No description provided for @blReportProblem.
  ///
  /// In en, this message translates to:
  /// **'Report a problem'**
  String get blReportProblem;

  /// No description provided for @blContactHidden.
  ///
  /// In en, this message translates to:
  /// **'Phone and exact address are shared only after the booking is accepted.'**
  String get blContactHidden;

  /// No description provided for @blShowGhardhaniContact.
  ///
  /// In en, this message translates to:
  /// **'Show Ghardhani\'s phone'**
  String get blShowGhardhaniContact;

  /// No description provided for @blShowSipaluContact.
  ///
  /// In en, this message translates to:
  /// **'Show Sipalu\'s phone'**
  String get blShowSipaluContact;

  /// No description provided for @blPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get blPhone;

  /// No description provided for @blAddress.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get blAddress;

  /// No description provided for @blLandmark.
  ///
  /// In en, this message translates to:
  /// **'Landmark'**
  String get blLandmark;

  /// No description provided for @blCopyNumber.
  ///
  /// In en, this message translates to:
  /// **'Copy number'**
  String get blCopyNumber;

  /// No description provided for @blContactExpires.
  ///
  /// In en, this message translates to:
  /// **'Hidden again 48 hours after the work is done.'**
  String get blContactExpires;

  /// No description provided for @blHowPaid.
  ///
  /// In en, this message translates to:
  /// **'How was the Sipalu paid?'**
  String get blHowPaid;

  /// No description provided for @blPaidDirectNote.
  ///
  /// In en, this message translates to:
  /// **'Money goes straight to the Sipalu. KaamSathi never holds it or takes a cut.'**
  String get blPaidDirectNote;

  /// No description provided for @blTagOnTime.
  ///
  /// In en, this message translates to:
  /// **'On time'**
  String get blTagOnTime;

  /// No description provided for @blTagCleanWork.
  ///
  /// In en, this message translates to:
  /// **'Clean work'**
  String get blTagCleanWork;

  /// No description provided for @blTagPolite.
  ///
  /// In en, this message translates to:
  /// **'Polite'**
  String get blTagPolite;

  /// No description provided for @blTagFairPrice.
  ///
  /// In en, this message translates to:
  /// **'Fair price'**
  String get blTagFairPrice;

  /// No description provided for @blTagSkilled.
  ///
  /// In en, this message translates to:
  /// **'Knew the job'**
  String get blTagSkilled;

  /// No description provided for @blTagRespectful.
  ///
  /// In en, this message translates to:
  /// **'Respectful'**
  String get blTagRespectful;

  /// No description provided for @blTagPaidAsAgreed.
  ///
  /// In en, this message translates to:
  /// **'Paid as agreed'**
  String get blTagPaidAsAgreed;

  /// No description provided for @blTagClearInstructions.
  ///
  /// In en, this message translates to:
  /// **'Clear instructions'**
  String get blTagClearInstructions;

  /// No description provided for @blPickStars.
  ///
  /// In en, this message translates to:
  /// **'Choose 1 to 5 stars.'**
  String get blPickStars;

  /// No description provided for @blRatingSaved.
  ///
  /// In en, this message translates to:
  /// **'Thank you. Your rating is saved.'**
  String get blRatingSaved;

  /// No description provided for @blRateSipalu.
  ///
  /// In en, this message translates to:
  /// **'Rate the Sipalu'**
  String get blRateSipalu;

  /// No description provided for @blRateGhardhani.
  ///
  /// In en, this message translates to:
  /// **'Rate the Ghardhani'**
  String get blRateGhardhani;

  /// No description provided for @blRateHint.
  ///
  /// In en, this message translates to:
  /// **'Only you two can rate each other, once. Reviews are checked before they show.'**
  String get blRateHint;

  /// No description provided for @blSendRating.
  ///
  /// In en, this message translates to:
  /// **'Send rating'**
  String get blSendRating;

  /// No description provided for @blAmountRs.
  ///
  /// In en, this message translates to:
  /// **'Amount (Rs)'**
  String get blAmountRs;

  /// No description provided for @blEnterAmount.
  ///
  /// In en, this message translates to:
  /// **'Enter an amount.'**
  String get blEnterAmount;

  /// No description provided for @blNotAboveQuoted.
  ///
  /// In en, this message translates to:
  /// **'Can\'t be more than the agreed {amount}.'**
  String blNotAboveQuoted(String amount);

  /// No description provided for @blWelcomeTitle.
  ///
  /// In en, this message translates to:
  /// **'What would you like to do?'**
  String get blWelcomeTitle;

  /// No description provided for @blChooseSipalu.
  ///
  /// In en, this message translates to:
  /// **'I want to find work'**
  String get blChooseSipalu;

  /// No description provided for @blChooseSipaluBody.
  ///
  /// In en, this message translates to:
  /// **'Become a Sipalu. Households book you directly and pay you directly — no commission.'**
  String get blChooseSipaluBody;

  /// No description provided for @blChooseGhardhani.
  ///
  /// In en, this message translates to:
  /// **'I want to book a Sipalu'**
  String get blChooseGhardhani;

  /// No description provided for @blChooseGhardhaniBody.
  ///
  /// In en, this message translates to:
  /// **'Find an ID-verified electrician, plumber, cook or cleaner near you.'**
  String get blChooseGhardhaniBody;

  /// No description provided for @blEmployerAddedMe.
  ///
  /// In en, this message translates to:
  /// **'Did an employer add you?'**
  String get blEmployerAddedMe;

  /// No description provided for @blEmployerAddedMeBody.
  ///
  /// In en, this message translates to:
  /// **'If your employer added you with this number, check again to open your work app.'**
  String get blEmployerAddedMeBody;

  /// No description provided for @blSwitchMode.
  ///
  /// In en, this message translates to:
  /// **'Switch mode'**
  String get blSwitchMode;

  /// No description provided for @blModeSipalu.
  ///
  /// In en, this message translates to:
  /// **'Sipalu'**
  String get blModeSipalu;

  /// No description provided for @blModeSipaluHint.
  ///
  /// In en, this message translates to:
  /// **'Your jobs, bookings and earnings'**
  String get blModeSipaluHint;

  /// No description provided for @blModeGhardhani.
  ///
  /// In en, this message translates to:
  /// **'Ghardhani'**
  String get blModeGhardhani;

  /// No description provided for @blModeGhardhaniHint.
  ///
  /// In en, this message translates to:
  /// **'Book a Sipalu for work at home'**
  String get blModeGhardhaniHint;

  /// No description provided for @blModeSupervisor.
  ///
  /// In en, this message translates to:
  /// **'Supervisor'**
  String get blModeSupervisor;

  /// No description provided for @blModeSupervisorHint.
  ///
  /// In en, this message translates to:
  /// **'Hajiri and teams for your employer'**
  String get blModeSupervisorHint;

  /// No description provided for @blBecomeSipalu.
  ///
  /// In en, this message translates to:
  /// **'Become a Sipalu'**
  String get blBecomeSipalu;

  /// No description provided for @blBecomeSipaluHint.
  ///
  /// In en, this message translates to:
  /// **'Get booked for your skills. No fees, ever.'**
  String get blBecomeSipaluHint;

  /// No description provided for @blWeeklyHours.
  ///
  /// In en, this message translates to:
  /// **'{hours} hours a week'**
  String blWeeklyHours(String hours);

  /// No description provided for @blDayOff.
  ///
  /// In en, this message translates to:
  /// **'Day off'**
  String get blDayOff;

  /// No description provided for @blAboutMinutes.
  ///
  /// In en, this message translates to:
  /// **'about {minutes} min'**
  String blAboutMinutes(String minutes);

  /// No description provided for @blPaused.
  ///
  /// In en, this message translates to:
  /// **'Paused'**
  String get blPaused;

  /// No description provided for @blAddService.
  ///
  /// In en, this message translates to:
  /// **'Add a service'**
  String get blAddService;

  /// No description provided for @blEditService.
  ///
  /// In en, this message translates to:
  /// **'Edit service'**
  String get blEditService;

  /// No description provided for @blServiceTitle.
  ///
  /// In en, this message translates to:
  /// **'What do you do?'**
  String get blServiceTitle;

  /// No description provided for @blServiceTitleHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. Ceiling fan fitting'**
  String get blServiceTitleHint;

  /// No description provided for @blServiceTitleNe.
  ///
  /// In en, this message translates to:
  /// **'Name in Nepali'**
  String get blServiceTitleNe;

  /// No description provided for @blHowCharge.
  ///
  /// In en, this message translates to:
  /// **'How do you charge?'**
  String get blHowCharge;

  /// No description provided for @blVisitFee.
  ///
  /// In en, this message translates to:
  /// **'Visit fee'**
  String get blVisitFee;

  /// No description provided for @blVisitFeeHint.
  ///
  /// In en, this message translates to:
  /// **'You look at the work first, then send a price. The Ghardhani approves it before you start.'**
  String get blVisitFeeHint;

  /// No description provided for @blPricePerHour.
  ///
  /// In en, this message translates to:
  /// **'Price per hour'**
  String get blPricePerHour;

  /// No description provided for @blPriceForJob.
  ///
  /// In en, this message translates to:
  /// **'Price for the job'**
  String get blPriceForJob;

  /// No description provided for @blMinHourlyHint.
  ///
  /// In en, this message translates to:
  /// **'At least {amount} an hour — the legal minimum wage.'**
  String blMinHourlyHint(String amount);

  /// No description provided for @blBelowMinHourly.
  ///
  /// In en, this message translates to:
  /// **'Hourly price must be at least {amount}, the minimum wage.'**
  String blBelowMinHourly(String amount);

  /// No description provided for @blEstimatedMinutes.
  ///
  /// In en, this message translates to:
  /// **'Usual time (minutes)'**
  String get blEstimatedMinutes;

  /// No description provided for @blServiceActive.
  ///
  /// In en, this message translates to:
  /// **'Show this service'**
  String get blServiceActive;

  /// No description provided for @blPickTradeFirst.
  ///
  /// In en, this message translates to:
  /// **'Add a skill first.'**
  String get blPickTradeFirst;

  /// No description provided for @blDirectPay.
  ///
  /// In en, this message translates to:
  /// **'Customers pay you directly — cash, eSewa, Khalti or bank. KaamSathi never takes a cut.'**
  String get blDirectPay;

  /// No description provided for @blStepBasics.
  ///
  /// In en, this message translates to:
  /// **'Your name and photo'**
  String get blStepBasics;

  /// No description provided for @blStepSkills.
  ///
  /// In en, this message translates to:
  /// **'Your skills'**
  String get blStepSkills;

  /// No description provided for @blStepLanguages.
  ///
  /// In en, this message translates to:
  /// **'Languages you speak'**
  String get blStepLanguages;

  /// No description provided for @blStepArea.
  ///
  /// In en, this message translates to:
  /// **'Where you work'**
  String get blStepArea;

  /// No description provided for @blStepAvailability.
  ///
  /// In en, this message translates to:
  /// **'When you are free'**
  String get blStepAvailability;

  /// No description provided for @blStepServices.
  ///
  /// In en, this message translates to:
  /// **'Services and prices'**
  String get blStepServices;

  /// No description provided for @blStepPayment.
  ///
  /// In en, this message translates to:
  /// **'How customers pay you'**
  String get blStepPayment;

  /// No description provided for @blStepIdentity.
  ///
  /// In en, this message translates to:
  /// **'ID for verification'**
  String get blStepIdentity;

  /// No description provided for @blStepHandle.
  ///
  /// In en, this message translates to:
  /// **'Your public profile'**
  String get blStepHandle;

  /// No description provided for @blStepOf.
  ///
  /// In en, this message translates to:
  /// **'Step {step} of {total}'**
  String blStepOf(String step, String total);

  /// No description provided for @blProfileComplete.
  ///
  /// In en, this message translates to:
  /// **'Profile complete'**
  String get blProfileComplete;

  /// No description provided for @blBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get blBack;

  /// No description provided for @blFinish.
  ///
  /// In en, this message translates to:
  /// **'Finish'**
  String get blFinish;

  /// No description provided for @blSaveContinue.
  ///
  /// In en, this message translates to:
  /// **'Save and continue'**
  String get blSaveContinue;

  /// No description provided for @blOnboardingDone.
  ///
  /// In en, this message translates to:
  /// **'Saved. We\'ll tell you when your ID is checked.'**
  String get blOnboardingDone;

  /// No description provided for @blCelebrateProfile.
  ///
  /// In en, this message translates to:
  /// **'Your Sipalu profile is complete.'**
  String get blCelebrateProfile;

  /// No description provided for @blCelebrateBookable.
  ///
  /// In en, this message translates to:
  /// **'You\'re verified. Ghardhani can now book you.'**
  String get blCelebrateBookable;

  /// No description provided for @blPhotoOnFile.
  ///
  /// In en, this message translates to:
  /// **'We have your photo. Add a new one only if you want to change it.'**
  String get blPhotoOnFile;

  /// No description provided for @blChangePhoto.
  ///
  /// In en, this message translates to:
  /// **'New photo'**
  String get blChangePhoto;

  /// No description provided for @blYourPhoto.
  ///
  /// In en, this message translates to:
  /// **'Your photo'**
  String get blYourPhoto;

  /// No description provided for @blPhotoHint.
  ///
  /// In en, this message translates to:
  /// **'A clear photo of your face, no sunglasses. Ghardhani see it when they book.'**
  String get blPhotoHint;

  /// No description provided for @blAddOneSkill.
  ///
  /// In en, this message translates to:
  /// **'Add at least one skill.'**
  String get blAddOneSkill;

  /// No description provided for @blSkillsHint.
  ///
  /// In en, this message translates to:
  /// **'Pick the work you do. The first one is your main skill.'**
  String get blSkillsHint;

  /// No description provided for @blMainSkill.
  ///
  /// In en, this message translates to:
  /// **'main'**
  String get blMainSkill;

  /// No description provided for @blYears.
  ///
  /// In en, this message translates to:
  /// **'Years'**
  String get blYears;

  /// No description provided for @blNstbLevel.
  ///
  /// In en, this message translates to:
  /// **'NSTB level'**
  String get blNstbLevel;

  /// No description provided for @blNstbNone.
  ///
  /// In en, this message translates to:
  /// **'No test yet'**
  String get blNstbNone;

  /// No description provided for @blNstbHint.
  ///
  /// In en, this message translates to:
  /// **'Have an NSTB certificate? Add it later from Learn so it can be checked.'**
  String get blNstbHint;

  /// No description provided for @blPickOneLanguage.
  ///
  /// In en, this message translates to:
  /// **'Pick at least one language.'**
  String get blPickOneLanguage;

  /// No description provided for @blLanguagesHint.
  ///
  /// In en, this message translates to:
  /// **'Ghardhani can look for someone who speaks their language.'**
  String get blLanguagesHint;

  /// No description provided for @blPickOneDistrict.
  ///
  /// In en, this message translates to:
  /// **'Pick at least one district.'**
  String get blPickOneDistrict;

  /// No description provided for @blAreaHint.
  ///
  /// In en, this message translates to:
  /// **'Where can you go for work?'**
  String get blAreaHint;

  /// No description provided for @blPickDistricts.
  ///
  /// In en, this message translates to:
  /// **'Choose districts'**
  String get blPickDistricts;

  /// No description provided for @blHowFar.
  ///
  /// In en, this message translates to:
  /// **'How far from home?'**
  String get blHowFar;

  /// No description provided for @blKm.
  ///
  /// In en, this message translates to:
  /// **'{km} km'**
  String blKm(String km);

  /// No description provided for @blAreaPrivacy.
  ///
  /// In en, this message translates to:
  /// **'Ghardhani never see your exact location — only your districts.'**
  String get blAreaPrivacy;

  /// No description provided for @blPickOneDay.
  ///
  /// In en, this message translates to:
  /// **'Turn on at least one day.'**
  String get blPickOneDay;

  /// No description provided for @blEndAfterStart.
  ///
  /// In en, this message translates to:
  /// **'End time must be after start time.'**
  String get blEndAfterStart;

  /// No description provided for @blTimeOff.
  ///
  /// In en, this message translates to:
  /// **'Time off'**
  String get blTimeOff;

  /// No description provided for @blAddTimeOff.
  ///
  /// In en, this message translates to:
  /// **'Add time off'**
  String get blAddTimeOff;

  /// No description provided for @blAddOneService.
  ///
  /// In en, this message translates to:
  /// **'Add at least one service.'**
  String get blAddOneService;

  /// No description provided for @blServicesHint.
  ///
  /// In en, this message translates to:
  /// **'Say what you do and what it costs. Ghardhani see the price before they book.'**
  String get blServicesHint;

  /// No description provided for @blWalletId.
  ///
  /// In en, this message translates to:
  /// **'{wallet} number'**
  String blWalletId(String wallet);

  /// No description provided for @blOwnAccountOnly.
  ///
  /// In en, this message translates to:
  /// **'Use your own account. Never pay anyone to get bookings.'**
  String get blOwnAccountOnly;

  /// No description provided for @blIdPhotoNeeded.
  ///
  /// In en, this message translates to:
  /// **'Add a photo of the front of your ID.'**
  String get blIdPhotoNeeded;

  /// No description provided for @blIdVerifiedNote.
  ///
  /// In en, this message translates to:
  /// **'Your ID is verified. Nothing more to do here.'**
  String get blIdVerifiedNote;

  /// No description provided for @blIdPendingNote.
  ///
  /// In en, this message translates to:
  /// **'We are checking your ID. This usually takes a day or two.'**
  String get blIdPendingNote;

  /// No description provided for @blIdWhy.
  ///
  /// In en, this message translates to:
  /// **'Only ID-verified Sipalu can be booked. Only KaamSathi\'s verification team sees your ID — never Ghardhani.'**
  String get blIdWhy;

  /// No description provided for @blCitizenship.
  ///
  /// In en, this message translates to:
  /// **'Citizenship'**
  String get blCitizenship;

  /// No description provided for @blIdNumber.
  ///
  /// In en, this message translates to:
  /// **'ID number'**
  String get blIdNumber;

  /// No description provided for @blIdFront.
  ///
  /// In en, this message translates to:
  /// **'Front of ID'**
  String get blIdFront;

  /// No description provided for @blIdBack.
  ///
  /// In en, this message translates to:
  /// **'Back of ID'**
  String get blIdBack;

  /// No description provided for @blConsentNeeded.
  ///
  /// In en, this message translates to:
  /// **'Tick the box to show your profile to Ghardhani.'**
  String get blConsentNeeded;

  /// No description provided for @blHeadline.
  ///
  /// In en, this message translates to:
  /// **'One line about your work'**
  String get blHeadline;

  /// No description provided for @blHeadlineHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. House wiring and fan fitting, 8 years'**
  String get blHeadlineHint;

  /// No description provided for @blHeadlineNe.
  ///
  /// In en, this message translates to:
  /// **'The same in Nepali'**
  String get blHeadlineNe;

  /// No description provided for @blHandle.
  ///
  /// In en, this message translates to:
  /// **'Profile link'**
  String get blHandle;

  /// No description provided for @blHandleHint.
  ///
  /// In en, this message translates to:
  /// **'3–30 small letters, numbers or -'**
  String get blHandleHint;

  /// No description provided for @blHandleInvalid.
  ///
  /// In en, this message translates to:
  /// **'Use 3–30 small letters (a–z), numbers or -.'**
  String get blHandleInvalid;

  /// No description provided for @blConsentPublic.
  ///
  /// In en, this message translates to:
  /// **'Show my Sipalu profile to Ghardhani'**
  String get blConsentPublic;

  /// No description provided for @blConsentPublicHint.
  ///
  /// In en, this message translates to:
  /// **'Name, photo, skills, services, prices, areas and reviews. Never your phone, address or ID.'**
  String get blConsentPublicHint;

  /// No description provided for @blTab.
  ///
  /// In en, this message translates to:
  /// **'Bolau'**
  String get blTab;

  /// No description provided for @blSegBookings.
  ///
  /// In en, this message translates to:
  /// **'Bookings'**
  String get blSegBookings;

  /// No description provided for @blSegNearby.
  ///
  /// In en, this message translates to:
  /// **'Nearby'**
  String get blSegNearby;

  /// No description provided for @blSegOffers.
  ///
  /// In en, this message translates to:
  /// **'My offers'**
  String get blSegOffers;

  /// No description provided for @blJoinTitle.
  ///
  /// In en, this message translates to:
  /// **'Get booked by households near you'**
  String get blJoinTitle;

  /// No description provided for @blJoinBody.
  ///
  /// In en, this message translates to:
  /// **'Make a Sipalu profile with your skills and prices. Ghardhani book you and pay you directly. KaamSathi never takes a cut.'**
  String get blJoinBody;

  /// No description provided for @blStatusFinishProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile {percent} done'**
  String blStatusFinishProfile(String percent);

  /// No description provided for @blStatusIdCheck.
  ///
  /// In en, this message translates to:
  /// **'Waiting for ID check'**
  String get blStatusIdCheck;

  /// No description provided for @blStatusPaused.
  ///
  /// In en, this message translates to:
  /// **'Not taking bookings'**
  String get blStatusPaused;

  /// No description provided for @blStatusBookable.
  ///
  /// In en, this message translates to:
  /// **'Ghardhani can book you'**
  String get blStatusBookable;

  /// No description provided for @blYourBolau.
  ///
  /// In en, this message translates to:
  /// **'Your Bolau'**
  String get blYourBolau;

  /// No description provided for @blContinueProfile.
  ///
  /// In en, this message translates to:
  /// **'Continue my profile'**
  String get blContinueProfile;

  /// No description provided for @blTakeBookings.
  ///
  /// In en, this message translates to:
  /// **'Take bookings'**
  String get blTakeBookings;

  /// No description provided for @blTakeBookingsHint.
  ///
  /// In en, this message translates to:
  /// **'Turn off when you are busy or away.'**
  String get blTakeBookingsHint;

  /// No description provided for @blTakeBookingsAfterId.
  ///
  /// In en, this message translates to:
  /// **'Bookings start once your ID is verified.'**
  String get blTakeBookingsAfterId;

  /// No description provided for @blInstantHint.
  ///
  /// In en, this message translates to:
  /// **'Free slots are booked straight away, without waiting for you to accept.'**
  String get blInstantHint;

  /// No description provided for @blServicesAndHours.
  ///
  /// In en, this message translates to:
  /// **'Services, prices and hours'**
  String get blServicesAndHours;

  /// No description provided for @blEarnings.
  ///
  /// In en, this message translates to:
  /// **'Earnings from Bolau'**
  String get blEarnings;

  /// No description provided for @blThisMonth.
  ///
  /// In en, this message translates to:
  /// **'This month'**
  String get blThisMonth;

  /// No description provided for @blAllTime.
  ///
  /// In en, this message translates to:
  /// **'All time'**
  String get blAllTime;

  /// No description provided for @blPaidJobs.
  ///
  /// In en, this message translates to:
  /// **'Paid jobs'**
  String get blPaidJobs;

  /// No description provided for @blEarningsNote.
  ///
  /// In en, this message translates to:
  /// **'Jobs marked paid. The money went straight to you — KaamSathi never holds it.'**
  String get blEarningsNote;

  /// No description provided for @blDeclineTitle.
  ///
  /// In en, this message translates to:
  /// **'Decline this booking?'**
  String get blDeclineTitle;

  /// No description provided for @blDeclineBody.
  ///
  /// In en, this message translates to:
  /// **'The Ghardhani will be told you can\'t come. Declining often lowers how high you show in search.'**
  String get blDeclineBody;

  /// No description provided for @blAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted. We\'ve told the Ghardhani.'**
  String get blAccepted;

  /// No description provided for @blDeclined.
  ///
  /// In en, this message translates to:
  /// **'Declined.'**
  String get blDeclined;

  /// No description provided for @blNoBookingsYet.
  ///
  /// In en, this message translates to:
  /// **'No bookings yet. Keep your hours up to date to get more.'**
  String get blNoBookingsYet;

  /// No description provided for @blIncoming.
  ///
  /// In en, this message translates to:
  /// **'New requests'**
  String get blIncoming;

  /// No description provided for @blAccept.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get blAccept;

  /// No description provided for @blUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Coming up'**
  String get blUpcoming;

  /// No description provided for @blPast.
  ///
  /// In en, this message translates to:
  /// **'Earlier'**
  String get blPast;

  /// No description provided for @blNoNearby.
  ///
  /// In en, this message translates to:
  /// **'No Kaam requests near you right now.'**
  String get blNoNearby;

  /// No description provided for @blNearbyHint.
  ///
  /// In en, this message translates to:
  /// **'Open requests in your trades and areas. The exact address is shared only after the Ghardhani picks your offer.'**
  String get blNearbyHint;

  /// No description provided for @blPreferred.
  ///
  /// In en, this message translates to:
  /// **'Preferred: {when}'**
  String blPreferred(String when);

  /// No description provided for @blBudgetUpTo.
  ///
  /// In en, this message translates to:
  /// **'Budget up to {amount}'**
  String blBudgetUpTo(String amount);

  /// No description provided for @blOffersCount.
  ///
  /// In en, this message translates to:
  /// **'{count} of {max} offers'**
  String blOffersCount(String count, String max);

  /// No description provided for @blYouOffered.
  ///
  /// In en, this message translates to:
  /// **'You sent an offer'**
  String get blYouOffered;

  /// No description provided for @blOfferAccepted.
  ///
  /// In en, this message translates to:
  /// **'Chosen'**
  String get blOfferAccepted;

  /// No description provided for @blOfferNotChosen.
  ///
  /// In en, this message translates to:
  /// **'Not chosen'**
  String get blOfferNotChosen;

  /// No description provided for @blOfferWithdrawn.
  ///
  /// In en, this message translates to:
  /// **'Withdrawn'**
  String get blOfferWithdrawn;

  /// No description provided for @blOfferPending.
  ///
  /// In en, this message translates to:
  /// **'Waiting'**
  String get blOfferPending;

  /// No description provided for @blWithdrawOffer.
  ///
  /// In en, this message translates to:
  /// **'Withdraw this offer?'**
  String get blWithdrawOffer;

  /// No description provided for @blWithdraw.
  ///
  /// In en, this message translates to:
  /// **'Withdraw'**
  String get blWithdraw;

  /// No description provided for @blNoOffersSent.
  ///
  /// In en, this message translates to:
  /// **'You haven\'t sent any offers yet.'**
  String get blNoOffersSent;

  /// No description provided for @blKaamRequest.
  ///
  /// In en, this message translates to:
  /// **'Kaam request'**
  String get blKaamRequest;

  /// No description provided for @blArrivedSaved.
  ///
  /// In en, this message translates to:
  /// **'Arrival confirmed. Start when you\'re ready.'**
  String get blArrivedSaved;

  /// No description provided for @blCodeLocked.
  ///
  /// In en, this message translates to:
  /// **'Too many wrong tries. Ask the Ghardhani to check the code in their app, or contact support.'**
  String get blCodeLocked;

  /// No description provided for @blCodeWrong.
  ///
  /// In en, this message translates to:
  /// **'That code doesn\'t match. Check with the Ghardhani.'**
  String get blCodeWrong;

  /// No description provided for @blCodeWrongLeft.
  ///
  /// In en, this message translates to:
  /// **'That code doesn\'t match. {left} tries left.'**
  String blCodeWrongLeft(String left);

  /// No description provided for @blOnTheWaySaved.
  ///
  /// In en, this message translates to:
  /// **'The Ghardhani knows you\'re on the way.'**
  String get blOnTheWaySaved;

  /// No description provided for @blSendQuote.
  ///
  /// In en, this message translates to:
  /// **'Send your price'**
  String get blSendQuote;

  /// No description provided for @blSendQuoteHint.
  ///
  /// In en, this message translates to:
  /// **'After looking at the work. The Ghardhani approves it before you start.'**
  String get blSendQuoteHint;

  /// No description provided for @blQuoteSent.
  ///
  /// In en, this message translates to:
  /// **'Price sent. Wait for the Ghardhani to approve.'**
  String get blQuoteSent;

  /// No description provided for @blStartedSaved.
  ///
  /// In en, this message translates to:
  /// **'Work started.'**
  String get blStartedSaved;

  /// No description provided for @blFinalPrice.
  ///
  /// In en, this message translates to:
  /// **'Final price'**
  String get blFinalPrice;

  /// No description provided for @blFinalPriceHint.
  ///
  /// In en, this message translates to:
  /// **'What the Ghardhani pays you. It can\'t be more than agreed.'**
  String get blFinalPriceHint;

  /// No description provided for @blCompletedSaved.
  ///
  /// In en, this message translates to:
  /// **'Marked done. The Ghardhani will confirm.'**
  String get blCompletedSaved;

  /// No description provided for @blPaidSaved.
  ///
  /// In en, this message translates to:
  /// **'Payment noted.'**
  String get blPaidSaved;

  /// No description provided for @blCancelJobTitle.
  ///
  /// In en, this message translates to:
  /// **'Cancel this job?'**
  String get blCancelJobTitle;

  /// No description provided for @blCancelJobBody.
  ///
  /// In en, this message translates to:
  /// **'Please only cancel if you really can\'t come. The Ghardhani will be told straight away.'**
  String get blCancelJobBody;

  /// No description provided for @blCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled.'**
  String get blCancelled;

  /// No description provided for @blImOnTheWay.
  ///
  /// In en, this message translates to:
  /// **'I\'m on the way'**
  String get blImOnTheWay;

  /// No description provided for @blStartWork.
  ///
  /// In en, this message translates to:
  /// **'Start work'**
  String get blStartWork;

  /// No description provided for @blWorkDone.
  ///
  /// In en, this message translates to:
  /// **'Work done'**
  String get blWorkDone;

  /// No description provided for @blMarkPaid.
  ///
  /// In en, this message translates to:
  /// **'Mark as paid'**
  String get blMarkPaid;

  /// No description provided for @blCancelJob.
  ///
  /// In en, this message translates to:
  /// **'Can\'t come — cancel'**
  String get blCancelJob;

  /// No description provided for @blBooking.
  ///
  /// In en, this message translates to:
  /// **'Booking'**
  String get blBooking;

  /// No description provided for @blForGhardhani.
  ///
  /// In en, this message translates to:
  /// **'For {name}'**
  String blForGhardhani(String name);

  /// No description provided for @blProgress.
  ///
  /// In en, this message translates to:
  /// **'Progress'**
  String get blProgress;

  /// No description provided for @blContact.
  ///
  /// In en, this message translates to:
  /// **'Contact'**
  String get blContact;

  /// No description provided for @blQuoteWaiting.
  ///
  /// In en, this message translates to:
  /// **'You quoted {amount}. Waiting for the Ghardhani to approve.'**
  String blQuoteWaiting(String amount);

  /// No description provided for @blPaidVia.
  ///
  /// In en, this message translates to:
  /// **'Paid · {method}'**
  String blPaidVia(String method);

  /// No description provided for @blWhatsNeeded.
  ///
  /// In en, this message translates to:
  /// **'What\'s needed'**
  String get blWhatsNeeded;

  /// No description provided for @blRequestGone.
  ///
  /// In en, this message translates to:
  /// **'This request is no longer open.'**
  String get blRequestGone;

  /// No description provided for @blPickWhen.
  ///
  /// In en, this message translates to:
  /// **'Choose when you can come.'**
  String get blPickWhen;

  /// No description provided for @blOfferSent.
  ///
  /// In en, this message translates to:
  /// **'Offer sent. We\'ll tell you if the Ghardhani picks it.'**
  String get blOfferSent;

  /// No description provided for @blRequestFull.
  ///
  /// In en, this message translates to:
  /// **'This request already has 3 offers.'**
  String get blRequestFull;

  /// No description provided for @blExactAddressLater.
  ///
  /// In en, this message translates to:
  /// **'You see the exact address only if the Ghardhani picks your offer.'**
  String get blExactAddressLater;

  /// No description provided for @blYouOfferedPrice.
  ///
  /// In en, this message translates to:
  /// **'You offered {price}.'**
  String blYouOfferedPrice(String price);

  /// No description provided for @blYourOffer.
  ///
  /// In en, this message translates to:
  /// **'Your offer'**
  String get blYourOffer;

  /// No description provided for @blWhenCanYouCome.
  ///
  /// In en, this message translates to:
  /// **'When can you come?'**
  String get blWhenCanYouCome;

  /// No description provided for @blOfferMessage.
  ///
  /// In en, this message translates to:
  /// **'Message to the Ghardhani'**
  String get blOfferMessage;

  /// No description provided for @blOfferMessageHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. I have fixed this kind of leak many times.'**
  String get blOfferMessageHint;

  /// No description provided for @blSendOffer.
  ///
  /// In en, this message translates to:
  /// **'Send offer'**
  String get blSendOffer;

  /// No description provided for @blRemoveService.
  ///
  /// In en, this message translates to:
  /// **'Remove this service?'**
  String get blRemoveService;

  /// No description provided for @blNoServices.
  ///
  /// In en, this message translates to:
  /// **'No services yet. Add what you do and your price.'**
  String get blNoServices;

  /// No description provided for @blSaveHours.
  ///
  /// In en, this message translates to:
  /// **'Save hours'**
  String get blSaveHours;

  /// No description provided for @blNoTimeOff.
  ///
  /// In en, this message translates to:
  /// **'No time off planned.'**
  String get blNoTimeOff;

  /// No description provided for @blRequests.
  ///
  /// In en, this message translates to:
  /// **'Requests'**
  String get blRequests;

  /// No description provided for @blHelloName.
  ///
  /// In en, this message translates to:
  /// **'Namaste, {name}'**
  String blHelloName(String name);

  /// No description provided for @blHomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Who do you need today?'**
  String get blHomeTitle;

  /// No description provided for @blSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Electrician, plumber, cook…'**
  String get blSearchHint;

  /// No description provided for @blSearch.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get blSearch;

  /// No description provided for @blPickTrade.
  ///
  /// In en, this message translates to:
  /// **'What kind of work?'**
  String get blPickTrade;

  /// No description provided for @blNextBooking.
  ///
  /// In en, this message translates to:
  /// **'Your next booking'**
  String get blNextBooking;

  /// No description provided for @blPostRequest.
  ///
  /// In en, this message translates to:
  /// **'Post a Kaam request'**
  String get blPostRequest;

  /// No description provided for @blPostRequestHint.
  ///
  /// In en, this message translates to:
  /// **'Describe the job and get up to 3 offers from verified Sipalu nearby.'**
  String get blPostRequestHint;

  /// No description provided for @blHowBolauWorks.
  ///
  /// In en, this message translates to:
  /// **'How Bolau works'**
  String get blHowBolauWorks;

  /// No description provided for @blPromiseVerified.
  ///
  /// In en, this message translates to:
  /// **'Every Sipalu you can book has had their ID checked by KaamSathi.'**
  String get blPromiseVerified;

  /// No description provided for @blPromisePrice.
  ///
  /// In en, this message translates to:
  /// **'You see the price before you book. No hidden fees.'**
  String get blPromisePrice;

  /// No description provided for @blPromisePayDirect.
  ///
  /// In en, this message translates to:
  /// **'You pay the Sipalu directly — cash, eSewa, Khalti or bank.'**
  String get blPromisePayDirect;

  /// No description provided for @blPromiseSafety.
  ///
  /// In en, this message translates to:
  /// **'Something wrong? Report it in confidence from any booking. In danger, call 100.'**
  String get blPromiseSafety;

  /// No description provided for @blPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get blPaid;

  /// No description provided for @blFindSipalu.
  ///
  /// In en, this message translates to:
  /// **'Find a Sipalu'**
  String get blFindSipalu;

  /// No description provided for @blFourStarsUp.
  ///
  /// In en, this message translates to:
  /// **'4★ and up'**
  String get blFourStarsUp;

  /// No description provided for @blNoSipaluFound.
  ///
  /// In en, this message translates to:
  /// **'No Sipalu free for this yet. Post a Kaam request and nearby Sipalu can send offers.'**
  String get blNoSipaluFound;

  /// No description provided for @blFavRemoved.
  ///
  /// In en, this message translates to:
  /// **'Removed from favourites.'**
  String get blFavRemoved;

  /// No description provided for @blFavAdded.
  ///
  /// In en, this message translates to:
  /// **'Saved to favourites.'**
  String get blFavAdded;

  /// No description provided for @blFavRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove from favourites'**
  String get blFavRemove;

  /// No description provided for @blFavAdd.
  ///
  /// In en, this message translates to:
  /// **'Save to favourites'**
  String get blFavAdd;

  /// No description provided for @blBookName.
  ///
  /// In en, this message translates to:
  /// **'Book {name}'**
  String blBookName(String name);

  /// No description provided for @blRepliesIn.
  ///
  /// In en, this message translates to:
  /// **'Usually replies in {minutes} min'**
  String blRepliesIn(String minutes);

  /// No description provided for @blVerification.
  ///
  /// In en, this message translates to:
  /// **'Verification'**
  String get blVerification;

  /// No description provided for @blNoServicesListed.
  ///
  /// In en, this message translates to:
  /// **'No services listed yet. You can still describe the job when you book.'**
  String get blNoServicesListed;

  /// No description provided for @blBook.
  ///
  /// In en, this message translates to:
  /// **'Book'**
  String get blBook;

  /// No description provided for @blSkillsAndAreas.
  ///
  /// In en, this message translates to:
  /// **'Skills and areas'**
  String get blSkillsAndAreas;

  /// No description provided for @blYearsN.
  ///
  /// In en, this message translates to:
  /// **'{years} yrs'**
  String blYearsN(String years);

  /// No description provided for @blWorksIn.
  ///
  /// In en, this message translates to:
  /// **'Works in {places}'**
  String blWorksIn(String places);

  /// No description provided for @blSpeaks.
  ///
  /// In en, this message translates to:
  /// **'Speaks {languages}'**
  String blSpeaks(String languages);

  /// No description provided for @blUsualHours.
  ///
  /// In en, this message translates to:
  /// **'Usual hours'**
  String get blUsualHours;

  /// No description provided for @blAskInBooking.
  ///
  /// In en, this message translates to:
  /// **'Pick a time when you book; the Sipalu confirms it.'**
  String get blAskInBooking;

  /// No description provided for @blAbout.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get blAbout;

  /// No description provided for @blReviews.
  ///
  /// In en, this message translates to:
  /// **'Reviews'**
  String get blReviews;

  /// No description provided for @blNoReviews.
  ///
  /// In en, this message translates to:
  /// **'No reviews yet.'**
  String get blNoReviews;

  /// No description provided for @blProfilePrivacy.
  ///
  /// In en, this message translates to:
  /// **'Phone numbers stay hidden until a booking is accepted. Talk through the app until then.'**
  String get blProfilePrivacy;

  /// No description provided for @blAddrOffice.
  ///
  /// In en, this message translates to:
  /// **'Office'**
  String get blAddrOffice;

  /// No description provided for @blAddrOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get blAddrOther;

  /// No description provided for @blAddrHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get blAddrHome;

  /// No description provided for @blRemoveAddress.
  ///
  /// In en, this message translates to:
  /// **'Remove this address?'**
  String get blRemoveAddress;

  /// No description provided for @blAddresses.
  ///
  /// In en, this message translates to:
  /// **'My addresses'**
  String get blAddresses;

  /// No description provided for @blAddAddress.
  ///
  /// In en, this message translates to:
  /// **'Add address'**
  String get blAddAddress;

  /// No description provided for @blEditAddress.
  ///
  /// In en, this message translates to:
  /// **'Edit address'**
  String get blEditAddress;

  /// No description provided for @blNoAddresses.
  ///
  /// In en, this message translates to:
  /// **'No addresses yet. Add one to book a Sipalu.'**
  String get blNoAddresses;

  /// No description provided for @blDefault.
  ///
  /// In en, this message translates to:
  /// **'default'**
  String get blDefault;

  /// No description provided for @blAddressPrivacy.
  ///
  /// In en, this message translates to:
  /// **'A Sipalu sees only your ward and municipality until they accept. Your exact address is hidden again 48 hours after the job.'**
  String get blAddressPrivacy;

  /// No description provided for @blAddrLine.
  ///
  /// In en, this message translates to:
  /// **'House, street or tole'**
  String get blAddrLine;

  /// No description provided for @blAddrLineHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. House 12, Jhamsikhel Marg'**
  String get blAddrLineHint;

  /// No description provided for @blWard.
  ///
  /// In en, this message translates to:
  /// **'Ward'**
  String get blWard;

  /// No description provided for @blMunicipality.
  ///
  /// In en, this message translates to:
  /// **'Municipality'**
  String get blMunicipality;

  /// No description provided for @blLandmarkHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. Opposite the blue gate school'**
  String get blLandmarkHint;

  /// No description provided for @blUseByDefault.
  ///
  /// In en, this message translates to:
  /// **'Use this address by default'**
  String get blUseByDefault;

  /// No description provided for @blBookTitle.
  ///
  /// In en, this message translates to:
  /// **'Book a Sipalu'**
  String get blBookTitle;

  /// No description provided for @blPickTime.
  ///
  /// In en, this message translates to:
  /// **'Choose a time'**
  String get blPickTime;

  /// No description provided for @blPickAddress.
  ///
  /// In en, this message translates to:
  /// **'Choose or add an address.'**
  String get blPickAddress;

  /// No description provided for @blDescribeJob.
  ///
  /// In en, this message translates to:
  /// **'Describe the job'**
  String get blDescribeJob;

  /// No description provided for @blBookedInstant.
  ///
  /// In en, this message translates to:
  /// **'Booked. The Sipalu has been told.'**
  String get blBookedInstant;

  /// No description provided for @blRequestSent.
  ///
  /// In en, this message translates to:
  /// **'Request sent. {name} has 30 minutes to reply.'**
  String blRequestSent(String name);

  /// No description provided for @blWhatWork.
  ///
  /// In en, this message translates to:
  /// **'What do you need?'**
  String get blWhatWork;

  /// No description provided for @blSomethingElse.
  ///
  /// In en, this message translates to:
  /// **'Something else'**
  String get blSomethingElse;

  /// No description provided for @blSomethingElseHint.
  ///
  /// In en, this message translates to:
  /// **'Describe it below; you agree on the price with the Sipalu.'**
  String get blSomethingElseHint;

  /// No description provided for @blNoteForSipalu.
  ///
  /// In en, this message translates to:
  /// **'Note for the Sipalu'**
  String get blNoteForSipalu;

  /// No description provided for @blDescribeHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. Bathroom tap leaking, need it fixed today'**
  String get blDescribeHint;

  /// No description provided for @blWhen.
  ///
  /// In en, this message translates to:
  /// **'When?'**
  String get blWhen;

  /// No description provided for @blToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get blToday;

  /// No description provided for @blNoSlots.
  ///
  /// In en, this message translates to:
  /// **'No free time on this day. Try another day.'**
  String get blNoSlots;

  /// No description provided for @blWhere.
  ///
  /// In en, this message translates to:
  /// **'Where?'**
  String get blWhere;

  /// No description provided for @blPrice.
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get blPrice;

  /// No description provided for @blToSipalu.
  ///
  /// In en, this message translates to:
  /// **'To the Sipalu'**
  String get blToSipalu;

  /// No description provided for @blAgreeOnPrice.
  ///
  /// In en, this message translates to:
  /// **'Agreed with the Sipalu'**
  String get blAgreeOnPrice;

  /// No description provided for @blBookingFee.
  ///
  /// In en, this message translates to:
  /// **'Booking fee'**
  String get blBookingFee;

  /// No description provided for @blFeeWaived.
  ///
  /// In en, this message translates to:
  /// **'Free for now'**
  String get blFeeWaived;

  /// No description provided for @blPayDirectNote.
  ///
  /// In en, this message translates to:
  /// **'You pay the Sipalu directly when the work is done — cash, eSewa, Khalti or bank. Nothing is added later.'**
  String get blPayDirectNote;

  /// No description provided for @blFeeNote.
  ///
  /// In en, this message translates to:
  /// **'The booking fee goes to KaamSathi, never out of the Sipalu\'s pay. Refunded if the Sipalu declines or doesn\'t come.'**
  String get blFeeNote;

  /// No description provided for @blFreeCancel.
  ///
  /// In en, this message translates to:
  /// **'Free to cancel until 2 hours before the start.'**
  String get blFreeCancel;

  /// No description provided for @blConfirmBooking.
  ///
  /// In en, this message translates to:
  /// **'Confirm booking'**
  String get blConfirmBooking;

  /// No description provided for @blSendRequest.
  ///
  /// In en, this message translates to:
  /// **'Send booking request'**
  String get blSendRequest;

  /// No description provided for @blInstantNote.
  ///
  /// In en, this message translates to:
  /// **'This Sipalu takes instant bookings — free slots are confirmed straight away.'**
  String get blInstantNote;

  /// No description provided for @blRequestNote.
  ///
  /// In en, this message translates to:
  /// **'The Sipalu has 30 minutes to accept. You\'ll get an SMS either way.'**
  String get blRequestNote;

  /// No description provided for @blMyBookings.
  ///
  /// In en, this message translates to:
  /// **'My bookings'**
  String get blMyBookings;

  /// No description provided for @blNoBookingsGhar.
  ///
  /// In en, this message translates to:
  /// **'No bookings yet. Find a Sipalu for the work you need.'**
  String get blNoBookingsGhar;

  /// No description provided for @blActive.
  ///
  /// In en, this message translates to:
  /// **'Now and coming up'**
  String get blActive;

  /// No description provided for @blCancelBookingTitle.
  ///
  /// In en, this message translates to:
  /// **'Cancel this booking?'**
  String get blCancelBookingTitle;

  /// No description provided for @blCancelFree.
  ///
  /// In en, this message translates to:
  /// **'It\'s free to cancel now. The Sipalu will be told straight away.'**
  String get blCancelFree;

  /// No description provided for @blCancelLate.
  ///
  /// In en, this message translates to:
  /// **'The start is less than 2 hours away. You can still cancel, but late cancellations are noted. The Sipalu is never charged.'**
  String get blCancelLate;

  /// No description provided for @blCancelLateShort.
  ///
  /// In en, this message translates to:
  /// **'Less than 2 hours to go — cancelling now is noted as late.'**
  String get blCancelLateShort;

  /// No description provided for @blApproveQuoteTitle.
  ///
  /// In en, this message translates to:
  /// **'Approve {amount}?'**
  String blApproveQuoteTitle(String amount);

  /// No description provided for @blApproveQuoteBody.
  ///
  /// In en, this message translates to:
  /// **'The Sipalu starts work after you approve. You pay them directly when it\'s done.'**
  String get blApproveQuoteBody;

  /// No description provided for @blApprove.
  ///
  /// In en, this message translates to:
  /// **'Approve'**
  String get blApprove;

  /// No description provided for @blQuoteApproved.
  ///
  /// In en, this message translates to:
  /// **'Price approved.'**
  String get blQuoteApproved;

  /// No description provided for @blConfirmDoneTitle.
  ///
  /// In en, this message translates to:
  /// **'Is the work done?'**
  String get blConfirmDoneTitle;

  /// No description provided for @blConfirmDoneBody.
  ///
  /// In en, this message translates to:
  /// **'Confirm only if you are happy with it. If something is wrong, report a problem instead.'**
  String get blConfirmDoneBody;

  /// No description provided for @blConfirmDone.
  ///
  /// In en, this message translates to:
  /// **'Yes, work is done'**
  String get blConfirmDone;

  /// No description provided for @blThanksConfirm.
  ///
  /// In en, this message translates to:
  /// **'Thanks. Don\'t forget to pay the Sipalu directly.'**
  String get blThanksConfirm;

  /// No description provided for @blNoShowTitle.
  ///
  /// In en, this message translates to:
  /// **'The Sipalu didn\'t come?'**
  String get blNoShowTitle;

  /// No description provided for @blNoShowBody.
  ///
  /// In en, this message translates to:
  /// **'We\'ll look into it and refund any booking fee.'**
  String get blNoShowBody;

  /// No description provided for @blReportNoShow.
  ///
  /// In en, this message translates to:
  /// **'Report: didn\'t come'**
  String get blReportNoShow;

  /// No description provided for @blNoShowSaved.
  ///
  /// In en, this message translates to:
  /// **'Reported. Our team will contact you.'**
  String get blNoShowSaved;

  /// No description provided for @blCancelBooking.
  ///
  /// In en, this message translates to:
  /// **'Cancel booking'**
  String get blCancelBooking;

  /// No description provided for @blApproveQuote.
  ///
  /// In en, this message translates to:
  /// **'Approve the price'**
  String get blApproveQuote;

  /// No description provided for @blSeeProfile.
  ///
  /// In en, this message translates to:
  /// **'See profile'**
  String get blSeeProfile;

  /// No description provided for @blWaitingSipalu.
  ///
  /// In en, this message translates to:
  /// **'Waiting for the Sipalu to accept. If there\'s no reply in 30 minutes, the request closes and you can book someone else.'**
  String get blWaitingSipalu;

  /// No description provided for @blQuoteToApprove.
  ///
  /// In en, this message translates to:
  /// **'The Sipalu quoted {amount} after looking at the work.'**
  String blQuoteToApprove(String amount);

  /// No description provided for @blPayDirectShort.
  ///
  /// In en, this message translates to:
  /// **'Pay the Sipalu directly. KaamSathi never holds the money.'**
  String get blPayDirectShort;

  /// No description provided for @blReqOffers.
  ///
  /// In en, this message translates to:
  /// **'Offers in'**
  String get blReqOffers;

  /// No description provided for @blReqBooked.
  ///
  /// In en, this message translates to:
  /// **'Booked'**
  String get blReqBooked;

  /// No description provided for @blReqOpen.
  ///
  /// In en, this message translates to:
  /// **'Waiting for offers'**
  String get blReqOpen;

  /// No description provided for @blMyRequests.
  ///
  /// In en, this message translates to:
  /// **'My Kaam requests'**
  String get blMyRequests;

  /// No description provided for @blNoRequests.
  ///
  /// In en, this message translates to:
  /// **'No Kaam requests yet. Post one and up to 3 verified Sipalu nearby can send offers.'**
  String get blNoRequests;

  /// No description provided for @blPickTradeShort.
  ///
  /// In en, this message translates to:
  /// **'Choose the kind of work.'**
  String get blPickTradeShort;

  /// No description provided for @blRequestPosted.
  ///
  /// In en, this message translates to:
  /// **'Posted. We\'ve told verified Sipalu nearby.'**
  String get blRequestPosted;

  /// No description provided for @blReqTitle.
  ///
  /// In en, this message translates to:
  /// **'What do you need done?'**
  String get blReqTitle;

  /// No description provided for @blReqDetails.
  ///
  /// In en, this message translates to:
  /// **'More details'**
  String get blReqDetails;

  /// No description provided for @blReqPhotos.
  ///
  /// In en, this message translates to:
  /// **'Photos (up to {max})'**
  String blReqPhotos(String max);

  /// No description provided for @blDay.
  ///
  /// In en, this message translates to:
  /// **'Day'**
  String get blDay;

  /// No description provided for @blFrom.
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get blFrom;

  /// No description provided for @blTo.
  ///
  /// In en, this message translates to:
  /// **'To'**
  String get blTo;

  /// No description provided for @blBudget.
  ///
  /// In en, this message translates to:
  /// **'Your budget'**
  String get blBudget;

  /// No description provided for @blReqPrivacy.
  ///
  /// In en, this message translates to:
  /// **'Sipalu see only your ward and municipality. Your exact address goes only to the Sipalu you pick.'**
  String get blReqPrivacy;

  /// No description provided for @blPostRequestCta.
  ///
  /// In en, this message translates to:
  /// **'Post request'**
  String get blPostRequestCta;

  /// No description provided for @blAcceptOfferTitle.
  ///
  /// In en, this message translates to:
  /// **'Book {name}?'**
  String blAcceptOfferTitle(String name);

  /// No description provided for @blAcceptOfferBody.
  ///
  /// In en, this message translates to:
  /// **'The other offers will be closed. You pay the Sipalu directly when the work is done.'**
  String get blAcceptOfferBody;

  /// No description provided for @blAcceptOffer.
  ///
  /// In en, this message translates to:
  /// **'Choose this offer'**
  String get blAcceptOffer;

  /// No description provided for @blOfferAcceptedSaved.
  ///
  /// In en, this message translates to:
  /// **'Booked. The Sipalu has been told.'**
  String get blOfferAcceptedSaved;

  /// No description provided for @blCancelRequest.
  ///
  /// In en, this message translates to:
  /// **'Close this request?'**
  String get blCancelRequest;

  /// No description provided for @blCancelRequestCta.
  ///
  /// In en, this message translates to:
  /// **'Close request'**
  String get blCancelRequestCta;

  /// No description provided for @blReqOpenUntil.
  ///
  /// In en, this message translates to:
  /// **'Open until {when}'**
  String blReqOpenUntil(String when);

  /// No description provided for @blOffersTitle.
  ///
  /// In en, this message translates to:
  /// **'Offers ({count} of {max})'**
  String blOffersTitle(String count, String max);

  /// No description provided for @blNoOffersYet.
  ///
  /// In en, this message translates to:
  /// **'No offers yet. Sipalu nearby have been told — offers usually come within an hour.'**
  String get blNoOffersYet;

  /// No description provided for @blNoOffersClosed.
  ///
  /// In en, this message translates to:
  /// **'This request closed without offers.'**
  String get blNoOffersClosed;

  /// No description provided for @blOpenBooking.
  ///
  /// In en, this message translates to:
  /// **'Open the booking'**
  String get blOpenBooking;

  /// No description provided for @blLowestPrice.
  ///
  /// In en, this message translates to:
  /// **'Lowest price'**
  String get blLowestPrice;

  /// No description provided for @blCanCome.
  ///
  /// In en, this message translates to:
  /// **'Can come {when}'**
  String blCanCome(String when);

  /// No description provided for @blFavourites.
  ///
  /// In en, this message translates to:
  /// **'Favourite Sipalu'**
  String get blFavourites;

  /// No description provided for @blSafetyHelp.
  ///
  /// In en, this message translates to:
  /// **'Safety and help'**
  String get blSafetyHelp;

  /// No description provided for @blSafetySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Harassment, unsafe work, payment trouble — in confidence'**
  String get blSafetySubtitle;

  /// No description provided for @blNoFavourites.
  ///
  /// In en, this message translates to:
  /// **'No favourites yet. Tap the heart on a Sipalu\'s profile to save them.'**
  String get blNoFavourites;

  /// No description provided for @blSafetyConfidential.
  ///
  /// In en, this message translates to:
  /// **'This report is confidential. The other person will not see it. Only KaamSathi\'s safety team reads it.'**
  String get blSafetyConfidential;

  /// No description provided for @blArea.
  ///
  /// In en, this message translates to:
  /// **'Area'**
  String get blArea;

  /// No description provided for @blTagExplainedWork.
  ///
  /// In en, this message translates to:
  /// **'Explained the work'**
  String get blTagExplainedWork;

  /// No description provided for @blTagSafePlace.
  ///
  /// In en, this message translates to:
  /// **'Safe place to work'**
  String get blTagSafePlace;

  /// No description provided for @blRejectQuote.
  ///
  /// In en, this message translates to:
  /// **'Decline the price'**
  String get blRejectQuote;

  /// No description provided for @blRejectQuoteTitle.
  ///
  /// In en, this message translates to:
  /// **'Decline this price?'**
  String get blRejectQuoteTitle;

  /// No description provided for @blRejectQuoteBody.
  ///
  /// In en, this message translates to:
  /// **'The Sipalu can send a new price, or you can cancel. You only pay the visit fee if they came.'**
  String get blRejectQuoteBody;

  /// No description provided for @blQuoteRejected.
  ///
  /// In en, this message translates to:
  /// **'Price declined. The Sipalu has been told.'**
  String get blQuoteRejected;

  /// No description provided for @blQuoteWasRejected.
  ///
  /// In en, this message translates to:
  /// **'The Ghardhani declined your price. You can send a new one.'**
  String get blQuoteWasRejected;

  /// No description provided for @blBelowMinForTime.
  ///
  /// In en, this message translates to:
  /// **'Too low for the time it takes — at least {amount} an hour (minimum wage).'**
  String blBelowMinForTime(String amount);

  /// No description provided for @blNotBookableWhy.
  ///
  /// In en, this message translates to:
  /// **'Not bookable yet: {reasons}'**
  String blNotBookableWhy(String reasons);

  /// No description provided for @blSuspended.
  ///
  /// In en, this message translates to:
  /// **'Bolau is paused for your profile. Contact support to know more.'**
  String get blSuspended;

  /// No description provided for @blPhotoNeeded.
  ///
  /// In en, this message translates to:
  /// **'Add a clear photo of your face.'**
  String get blPhotoNeeded;

  /// No description provided for @blAnswerBy.
  ///
  /// In en, this message translates to:
  /// **'Answer by {when}'**
  String blAnswerBy(String when);

  /// No description provided for @blFreeCancelHours.
  ///
  /// In en, this message translates to:
  /// **'Free to cancel until {hours} hours before the start.'**
  String blFreeCancelHours(String hours);

  /// No description provided for @blCancelLateHours.
  ///
  /// In en, this message translates to:
  /// **'The start is less than {hours} hours away. You can still cancel, but late cancellations are noted. The Sipalu is never charged.'**
  String blCancelLateHours(String hours);

  /// No description provided for @blCancelLateShortHours.
  ///
  /// In en, this message translates to:
  /// **'Less than {hours} hours to go — cancelling now is noted as late.'**
  String blCancelLateShortHours(String hours);

  /// No description provided for @blWaitingSipaluMin.
  ///
  /// In en, this message translates to:
  /// **'Waiting for the Sipalu to accept. If there\'s no reply in {minutes} minutes, the request closes and you can book someone else.'**
  String blWaitingSipaluMin(String minutes);

  /// No description provided for @blRequestNoteMin.
  ///
  /// In en, this message translates to:
  /// **'The Sipalu has {minutes} minutes to accept. You\'ll get an SMS either way.'**
  String blRequestNoteMin(String minutes);

  /// No description provided for @blFeeIsKaamSathi.
  ///
  /// In en, this message translates to:
  /// **'The booking fee is KaamSathi\'s own fee. You pay the Sipalu directly — KaamSathi never takes anything from their pay.'**
  String get blFeeIsKaamSathi;

  /// No description provided for @blPayFee.
  ///
  /// In en, this message translates to:
  /// **'Pay booking fee'**
  String get blPayFee;

  /// No description provided for @blPayFeeTitle.
  ///
  /// In en, this message translates to:
  /// **'Pay the booking fee'**
  String get blPayFeeTitle;

  /// No description provided for @blPayFeeBody.
  ///
  /// In en, this message translates to:
  /// **'{amount} to KaamSathi. This is not the Sipalu\'s pay — you pay them directly.'**
  String blPayFeeBody(String amount);

  /// No description provided for @blFeeNotConfigured.
  ///
  /// In en, this message translates to:
  /// **'Online payment isn\'t available yet — your booking is still confirmed.'**
  String get blFeeNotConfigured;

  /// No description provided for @blFeePayLink.
  ///
  /// In en, this message translates to:
  /// **'Finish paying with {provider} at this link:'**
  String blFeePayLink(String provider);

  /// No description provided for @blFeeDue.
  ///
  /// In en, this message translates to:
  /// **'Due'**
  String get blFeeDue;

  /// No description provided for @blFeeNotCollected.
  ///
  /// In en, this message translates to:
  /// **'Not collected now'**
  String get blFeeNotCollected;

  /// No description provided for @blFeePaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get blFeePaid;

  /// No description provided for @blFeeRefunded.
  ///
  /// In en, this message translates to:
  /// **'Refunded'**
  String get blFeeRefunded;

  /// No description provided for @blFeeReceipt.
  ///
  /// In en, this message translates to:
  /// **'Booking fee receipt'**
  String get blFeeReceipt;

  /// No description provided for @blFeeOptional.
  ///
  /// In en, this message translates to:
  /// **'The booking is confirmed either way — paying the fee never blocks the work.'**
  String get blFeeOptional;

  /// No description provided for @blRaiseDispute.
  ///
  /// In en, this message translates to:
  /// **'Raise a dispute'**
  String get blRaiseDispute;

  /// No description provided for @blRaiseDisputeTitle.
  ///
  /// In en, this message translates to:
  /// **'Raise a dispute about this booking'**
  String get blRaiseDisputeTitle;

  /// No description provided for @blRaiseDisputeHint.
  ///
  /// In en, this message translates to:
  /// **'Say what went wrong — price, payment, damage or work not done. KaamSathi support looks at both sides. You can add photos after sending.'**
  String get blRaiseDisputeHint;

  /// No description provided for @blRaiseDisputeGharHint.
  ///
  /// In en, this message translates to:
  /// **'Say what went wrong — price, payment, damage or work not done. KaamSathi support looks at both sides and will contact you.'**
  String get blRaiseDisputeGharHint;

  /// No description provided for @blDisputeWhat.
  ///
  /// In en, this message translates to:
  /// **'What happened?'**
  String get blDisputeWhat;

  /// No description provided for @blDisputeSent.
  ///
  /// In en, this message translates to:
  /// **'Dispute sent. Support will look into it.'**
  String get blDisputeSent;

  /// No description provided for @blDisputeSupportNote.
  ///
  /// In en, this message translates to:
  /// **'KaamSathi support is looking into this and will contact you. For anything urgent, use “Report a problem”.'**
  String get blDisputeSupportNote;

  /// No description provided for @blPortfolio.
  ///
  /// In en, this message translates to:
  /// **'Work photos'**
  String get blPortfolio;

  /// No description provided for @blPortfolioManage.
  ///
  /// In en, this message translates to:
  /// **'Manage work photos'**
  String get blPortfolioManage;

  /// No description provided for @blPortfolioEmpty.
  ///
  /// In en, this message translates to:
  /// **'No work photos yet. Photos of finished work help households choose you.'**
  String get blPortfolioEmpty;

  /// No description provided for @blPortfolioAdd.
  ///
  /// In en, this message translates to:
  /// **'Add photo'**
  String get blPortfolioAdd;

  /// No description provided for @blPortfolioCount.
  ///
  /// In en, this message translates to:
  /// **'{count} of {max} photos'**
  String blPortfolioCount(String count, String max);

  /// No description provided for @blPortfolioFull.
  ///
  /// In en, this message translates to:
  /// **'You can show up to {max} photos. Delete one to add another.'**
  String blPortfolioFull(String max);

  /// No description provided for @blPortfolioCaption.
  ///
  /// In en, this message translates to:
  /// **'Caption (English)'**
  String get blPortfolioCaption;

  /// No description provided for @blPortfolioCaptionNe.
  ///
  /// In en, this message translates to:
  /// **'Caption (Nepali)'**
  String get blPortfolioCaptionNe;

  /// No description provided for @blPortfolioTrade.
  ///
  /// In en, this message translates to:
  /// **'Trade'**
  String get blPortfolioTrade;

  /// No description provided for @blPortfolioAnyTrade.
  ///
  /// In en, this message translates to:
  /// **'Not set'**
  String get blPortfolioAnyTrade;

  /// No description provided for @blPortfolioEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit photo'**
  String get blPortfolioEdit;

  /// No description provided for @blPortfolioDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete photo'**
  String get blPortfolioDelete;

  /// No description provided for @blPortfolioDeleteBody.
  ///
  /// In en, this message translates to:
  /// **'It will no longer show on your profile.'**
  String get blPortfolioDeleteBody;

  /// No description provided for @blPortfolioSaved.
  ///
  /// In en, this message translates to:
  /// **'Photo saved'**
  String get blPortfolioSaved;

  /// No description provided for @blPortfolioDeleted.
  ///
  /// In en, this message translates to:
  /// **'Photo deleted'**
  String get blPortfolioDeleted;

  /// No description provided for @blPortfolioTooBig.
  ///
  /// In en, this message translates to:
  /// **'This photo is too large (8 MB at most).'**
  String get blPortfolioTooBig;

  /// No description provided for @blPortfolioPublic.
  ///
  /// In en, this message translates to:
  /// **'Shown on your public profile. Only your own work — no customers\' faces, house numbers or documents.'**
  String get blPortfolioPublic;

  /// No description provided for @blPortfolioPhotoAlt.
  ///
  /// In en, this message translates to:
  /// **'Work photo: {caption}'**
  String blPortfolioPhotoAlt(String caption);

  /// No description provided for @blPortfolioPhoto.
  ///
  /// In en, this message translates to:
  /// **'Work photo'**
  String get blPortfolioPhoto;
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>['en', 'ne'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'ne':
      return AppLocalizationsNe();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}

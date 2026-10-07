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
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('ne')
  ];

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
  /// **'Checked in. Have a good day at work!'**
  String get checkInSuccess;

  /// No description provided for @checkOutSuccess.
  ///
  /// In en, this message translates to:
  /// **'Checked out. See you tomorrow!'**
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
    case 'en': return AppLocalizationsEn();
    case 'ne': return AppLocalizationsNe();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.'
  );
}

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
  /// **'No offers right now.'**
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

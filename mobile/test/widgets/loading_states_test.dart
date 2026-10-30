import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/api_activity.dart';
import 'package:kaamsathi/core/l10n/l10n.dart';
import 'package:kaamsathi/core/providers.dart';
import 'package:kaamsathi/core/theme/app_theme.dart';
import 'package:kaamsathi/core/widgets/common.dart';
import 'package:kaamsathi/core/widgets/eco.dart';
import 'package:kaamsathi/core/widgets/network_activity.dart';

/// Pumps [child] in a localised, themed app without settling: the skeleton
/// shimmer repeats forever, so `pumpAndSettle` would never return.
Future<void> _pump(WidgetTester tester, Widget child, {String lang = 'en', bool reduceMotion = false}) async {
  await tester.pumpWidget(
    MaterialApp(
      locale: Locale(lang),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: buildTheme(Brightness.light, lang: lang, useGoogleFonts: false),
      home: Builder(
        builder:
            (context) => MediaQuery(
              data: MediaQuery.of(context).copyWith(disableAnimations: reduceMotion),
              child: Scaffold(body: child),
            ),
      ),
    ),
  );
}

Finder _shimmerMasks() => find.descendant(of: find.byType(Skeleton), matching: find.byType(ShaderMask));

void main() {
  group('AsyncBody loading', () {
    testWidgets('shows the card-list skeleton, not a spinner, with a localized label', (tester) async {
      final semantics = tester.ensureSemantics();
      await _pump(tester, const AsyncBody<String>(value: AsyncLoading(), data: Text.new), lang: 'ne');
      expect(find.byType(SkeletonList), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.bySemanticsLabel('लोड हुँदैछ…'), findsOneWidget);
      semantics.dispose();
    });

    testWidgets('uses the loading override and fades into the data', (tester) async {
      Widget body(AsyncValue<String> v) => AsyncBody<String>(value: v, data: Text.new, loading: const SkeletonDetail());
      await _pump(tester, body(const AsyncLoading()));
      expect(find.byType(SkeletonDetail), findsOneWidget);
      expect(find.byType(SkeletonList), findsNothing);

      await _pump(tester, body(const AsyncData('hello')));
      expect(find.text('hello'), findsOneWidget);
      await tester.pumpAndSettle();
      expect(find.byType(Skeleton), findsNothing);
      expect(find.text('hello'), findsOneWidget);
    });

    testWidgets('keeps showing data while refreshing', (tester) async {
      var calls = 0;
      final p = FutureProvider<String>((ref) async {
        calls++;
        if (calls == 1) return 'cached';
        return Future<String>.delayed(const Duration(seconds: 1), () => 'fresh');
      });
      final container = ProviderContainer();
      addTearDown(container.dispose);
      await _pump(
        tester,
        UncontrolledProviderScope(
          container: container,
          child: Consumer(builder: (context, ref, _) => AsyncBody<String>(value: ref.watch(p), data: Text.new)),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('cached'), findsOneWidget);

      container.invalidate(p);
      await tester.pump();
      expect(container.read(p).isLoading, isTrue);
      expect(find.text('cached'), findsOneWidget);
      expect(find.byType(Skeleton), findsNothing);

      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
      expect(find.text('fresh'), findsOneWidget);
    });

    testWidgets('FeatureAsyncSection defaults to the compact skeleton', (tester) async {
      await _pump(
        tester,
        ListView(children: [const FeatureAsyncSection<String>(value: AsyncLoading<String>(), data: Text.new)]),
      );
      expect(find.byType(SkeletonSection), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });
  });

  group('Skeleton motion', () {
    testWidgets('shimmers when animations are allowed', (tester) async {
      await _pump(tester, const SkeletonList(count: 2));
      expect(_shimmerMasks(), findsWidgets);
      expect(tester.hasRunningAnimations, isTrue);
    });

    testWidgets('renders static blocks under reduced motion', (tester) async {
      await _pump(tester, const SkeletonList(count: 2), reduceMotion: true);
      expect(find.byType(SkeletonBlock), findsWidgets);
      expect(_shimmerMasks(), findsNothing);
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('NetworkActivityIndicator', () {
    late DateTime now;
    late ApiActivity activity;

    setUp(() {
      now = DateTime(2026);
      activity = ApiActivity(clock: () => now);
    });

    Future<void> pumpIndicator(WidgetTester tester) => _pump(
      tester,
      ProviderScope(
        overrides: [apiActivityProvider.overrideWithValue(activity)],
        child: const NetworkActivityIndicator(child: SizedBox.expand()),
      ),
    );

    Future<void> advance(WidgetTester tester, Duration d) async {
      now = now.add(d);
      await tester.pump(d);
    }

    testWidgets('stays quiet for fast requests and hints once a request is slow', (tester) async {
      await pumpIndicator(tester);
      final req = RequestOptions(path: '/x');
      activity.interceptor.onRequest(req, RequestInterceptorHandler());
      await advance(tester, const Duration(milliseconds: 1000));
      expect(find.text('Slow connection…'), findsNothing);

      await advance(tester, const Duration(milliseconds: 600));
      expect(find.text('Slow connection…'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);

      activity.interceptor.onResponse(Response(requestOptions: req, statusCode: 200), ResponseInterceptorHandler());
      await tester.pumpAndSettle();
      expect(find.text('Slow connection…'), findsNothing);
      expect(find.byType(LinearProgressIndicator), findsNothing);
    });

    testWidgets('shows a short-lived offline hint when the server cannot be reached', (tester) async {
      await pumpIndicator(tester);
      final req = RequestOptions(path: '/x');
      // The handler passes the error on to a caller that is not there in
      // this test; swallow it.
      runZonedGuarded(() {
        activity.interceptor.onRequest(req, RequestInterceptorHandler());
        activity.interceptor.onError(
          DioException(requestOptions: req, type: DioExceptionType.connectionError),
          ErrorInterceptorHandler(),
        );
      }, (_, _) {});
      await tester.pump();
      expect(find.text('No internet connection'), findsOneWidget);

      await advance(tester, NetworkActivityIndicator.offlineFor);
      await tester.pumpAndSettle();
      expect(find.text('No internet connection'), findsNothing);
    });

    testWidgets('does not track file downloads', (tester) async {
      await pumpIndicator(tester);
      activity.interceptor.onRequest(
        RequestOptions(path: '/payslip.pdf', responseType: ResponseType.stream),
        RequestInterceptorHandler(),
      );
      expect(activity.busy, isFalse);
      await advance(tester, const Duration(seconds: 3));
      expect(find.text('Slow connection…'), findsNothing);
    });
  });
}

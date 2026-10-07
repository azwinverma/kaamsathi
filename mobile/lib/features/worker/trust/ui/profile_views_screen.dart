import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../trust_data.dart';

String viewContextLabel(AppLocalizations l, ProfileView v) {
  if (v.contextLabel?.isNotEmpty ?? false) return v.contextLabel!;
  return switch (v.context) {
    'application' => l.viewCtxApplication,
    'employment' => l.viewCtxEmployment,
    'ops' => l.viewCtxOps,
    'partner' => l.viewCtxPartner,
    'passport' => l.viewCtxPassport,
    'crew' => l.viewCtxCrew,
    _ => v.context,
  };
}

/// "Who viewed my profile" — every full-profile view is logged (ECOSYSTEM §1).
class ProfileViewsScreen extends ConsumerWidget {
  const ProfileViewsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final value = ref.watch(profileViewsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.profileViewsTitle)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(profileViewsProvider);
          try {
            await ref.read(profileViewsProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<ProfileView>>(
          value: value,
          onRetry: () => ref.invalidate(profileViewsProvider),
          data:
              (views) => ListView(
                padding: const EdgeInsets.all(KsSpace.page),
                children: [
                  Text(l.profileViewsHint, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: KsSpace.s3),
                  if (views.isEmpty) EmptyState(icon: LucideIcons.eyeOff, message: l.profileViewsEmpty),
                  for (final v in views)
                    Card(
                      child: ListTile(
                        leading: Icon(
                          v.partner != null
                              ? LucideIcons.landmark
                              : v.organization != null
                              ? LucideIcons.building2
                              : LucideIcons.shieldCheck,
                        ),
                        title: Text(v.viewerName ?? l.viewByKaamSathi),
                        subtitle: Text(viewContextLabel(l, v)),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(formatBsDateTime(v.createdAt, lang), style: Theme.of(context).textTheme.bodySmall),
                            if (v.createdAt != null)
                              Text(formatTime(v.createdAt!, lang), style: Theme.of(context).textTheme.bodySmall),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
        ),
      ),
    );
  }
}

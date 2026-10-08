import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/session.dart';
import '../../l10n/l10n.dart';
import '../../providers.dart';
import '../../storage/prefs.dart';
import 'celebration.dart';

/// Celebrates [milestone] when it is seen going from "not reached" to
/// "reached" for the signed-in worker — once, ever.
///
/// The first observation only records a baseline (a worker who already had
/// a verified certificate before this screen existed is not congratulated
/// out of the blue). [reached] is `null` while the data is loading.
class MilestoneWatch extends ConsumerStatefulWidget {
  const MilestoneWatch({super.key, required this.milestone, required this.reached, required this.child});

  final Milestone milestone;
  final bool? reached;
  final Widget child;

  @override
  ConsumerState<MilestoneWatch> createState() => _MilestoneWatchState();
}

class _MilestoneWatchState extends ConsumerState<MilestoneWatch> {
  bool? _handled;

  @override
  Widget build(BuildContext context) {
    final reached = widget.reached;
    if (reached != null && reached != _handled) {
      _handled = reached;
      WidgetsBinding.instance.addPostFrameCallback((_) => _check(reached));
    }
    return widget.child;
  }

  Future<void> _check(bool reached) async {
    if (!mounted) return;
    final String userId;
    final Prefs prefs;
    try {
      userId = ref.read(sessionProvider).me?.id ?? '';
      prefs = ref.read(prefsProvider);
    } catch (_) {
      return; // no session / prefs (e.g. isolated widget tests)
    }
    if (userId.isEmpty) return;
    final kind = widget.milestone.name;
    final before = prefs.milestone(userId, kind);
    if (before == reached || before == true) return;
    await prefs.setMilestone(userId, kind, reached);
    if (before == false && reached && mounted) {
      celebrate(context, milestoneMessage(context.l10n, widget.milestone));
    }
  }
}

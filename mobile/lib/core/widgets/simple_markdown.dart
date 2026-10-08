import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// One parsed markdown block.
sealed class MdBlock {
  const MdBlock();
}

class MdHeading extends MdBlock {
  const MdHeading(this.level, this.text);
  final int level;
  final String text;
}

class MdParagraph extends MdBlock {
  const MdParagraph(this.text);
  final String text;
}

class MdListItem extends MdBlock {
  const MdListItem(this.text, {this.number});
  final String text;

  /// null = bullet.
  final String? number;
}

/// Minimal markdown: `#`–`###` headings, `-`/`*`/`1.` list items, blank-line
/// separated paragraphs, `**bold**`. Everything else is shown as plain text.
List<MdBlock> parseMarkdown(String src) {
  final out = <MdBlock>[];
  final para = <String>[];
  void flush() {
    if (para.isNotEmpty) {
      out.add(MdParagraph(para.join(' ')));
      para.clear();
    }
  }

  for (final raw in src.replaceAll('\r\n', '\n').split('\n')) {
    final line = raw.trim();
    if (line.isEmpty) {
      flush();
      continue;
    }
    final h = RegExp(r'^(#{1,6})\s+(.*)$').firstMatch(line);
    if (h != null) {
      flush();
      out.add(MdHeading(h.group(1)!.length, h.group(2)!.trim()));
      continue;
    }
    final b = RegExp(r'^[-*+]\s+(.*)$').firstMatch(line);
    if (b != null) {
      flush();
      out.add(MdListItem(b.group(1)!));
      continue;
    }
    final n = RegExp(r'^(\d+)[.)]\s+(.*)$').firstMatch(line);
    if (n != null) {
      flush();
      out.add(MdListItem(n.group(2)!, number: n.group(1)));
      continue;
    }
    para.add(line);
  }
  flush();
  return out;
}

/// `**bold**` spans; links `[text](url)` are shown as "text (url)".
List<TextSpan> _inline(String text, TextStyle? base) {
  final t = text.replaceAllMapped(RegExp(r'\[([^\]]+)\]\(([^)]+)\)'), (m) => '${m[1]} (${m[2]})');
  final spans = <TextSpan>[];
  final parts = t.split('**');
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].isEmpty) continue;
    spans.add(TextSpan(text: parts[i], style: i.isOdd ? base?.copyWith(fontWeight: FontWeight.w700) : base));
  }
  return spans;
}

class SimpleMarkdown extends StatelessWidget {
  const SimpleMarkdown(this.source, {super.key});
  final String source;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final b in parseMarkdown(source))
          switch (b) {
            MdHeading(:final level, :final text) => Padding(
              padding: const EdgeInsets.only(top: KsSpace.s3, bottom: KsSpace.s1),
              child: Text(text, style: level <= 1 ? t.titleLarge : (level == 2 ? t.titleMedium : t.titleSmall)),
            ),
            MdParagraph(:final text) => Padding(
              padding: const EdgeInsets.only(bottom: KsSpace.s2),
              child: Text.rich(TextSpan(children: _inline(text, t.bodyLarge))),
            ),
            MdListItem(:final text, :final number) => Padding(
              padding: const EdgeInsets.only(left: KsSpace.s2, bottom: KsSpace.s1),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: 24, child: Text(number == null ? '•' : '$number.', style: t.bodyLarge)),
                  Expanded(child: Text.rich(TextSpan(children: _inline(text, t.bodyLarge)))),
                ],
              ),
            ),
          },
      ],
    );
  }
}

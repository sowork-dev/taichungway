#!/usr/bin/env python3
"""Import supplied policy JSON literals without executing archive JavaScript.

Usage: python3 scripts/import-policy-zip.py /explicit/path/to/archive.zip
Only text-derived JSON is written. Source HTML/assets are never extracted.
"""
import argparse
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import zipfile

SOURCE_SHA256 = 'fd4c2ebf572160971de4cb1c4a2def74bb8b8747dfca79936cfc071543942a2b'
TOPIC_IDS = ('exhibition-168', 'robot-city', 'parenting', 'senior-care',
             'culture-starlight', 'smart-agriculture', 'airport-gateway',
             'smart-transport', 'city-safety', 'twenty-minute-city',
             'new-residents', 'indigenous', 'animal-welfare', 'hakka', 'education')
SOURCE_FILES = tuple(f'{i:02d}-{topic}.html' for i, topic in enumerate(TOPIC_IDS, 1))
IMPORT_DATE = '2026-10-25'


class TextOnly(HTMLParser):
    """Remove markup while keeping adjacent inline wording and decoded entities."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'br':
            self.parts.append('\n')


def plain(value):
    parser = TextOnly()
    parser.feed(value)
    parser.close()
    return ''.join(parser.parts)


class SourcePage(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.in_script = False
        self.title = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'title':
            self.in_title = True
        elif tag == 'script':
            self.in_script = not dict(attrs).get('src')

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        elif tag == 'script':
            self.in_script = False

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        if self.in_script:
            self.scripts.append(data)


def reject_constant(value):
    raise ValueError(f'Non-JSON constant: {value}')


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'Duplicate JSON key: {key}')
        result[key] = value
    return result


def literal(scripts, name):
    matches = list(re.finditer(r'\bconst\s+' + re.escape(name) + r'\s*=\s*', scripts))
    if len(matches) != 1:
        raise ValueError(f'Expected one JSON const {name}, found {len(matches)}')
    tail = scripts[matches[0].end():]
    value, end = json.JSONDecoder(parse_constant=reject_constant,
                                  object_pairs_hook=unique_object).raw_decode(tail)
    if not tail[end:].lstrip().startswith(';'):
        raise ValueError(f'{name} must be a JSON literal, not a JavaScript expression')
    return value


def parse_topic(filename, html):
    page = SourcePage()
    page.feed(html)
    page.close()
    scripts = '\n'.join(page.scripts)
    topic_id = re.sub(r'^\d{2}-', '', filename[:-5])
    stages = literal(scripts, 'STAGES')
    pads = literal(scripts, 'PADS')
    detail_note = literal(scripts, 'DETAIL_NOTE')
    result = {
        'id': topic_id, 'title': ''.join(page.title), 'sourceFile': filename,
        'sourceUrl': 'https://taichung.sowork.ai/' + filename,
        'stages': [{key: [plain(c) for c in stage[key]] if key == 'chips'
                    else plain(stage[key]) for key in ('n', 't', 's', 'note', 'chips')}
                   for stage in stages],
        'pads': [{'title': plain(pad['o']), 'description': plain(pad['d']),
                  'details': [plain(bullet) for bullet in pad['b']],
                  'recordId': f'archive-{topic_id}-pad-{i}'}
                 for i, pad in enumerate(pads, 1)],
        'detailNote': plain(detail_note),
        'recordIds': [f'archive-{topic_id}-overview'] +
                     [f'archive-{topic_id}-pad-{i}' for i in range(1, len(pads) + 1)],
    }
    return result


NOTICE = '使用者提供的政見提案；未獨立查證，不代表已施行。'
ORIGINAL_PREFIX_SHA256 = 'c1304e59bff190797504e54c99b58578c31b02285496e4e2dc96ce4dbc5bdb2d'


def short_source(text):
    # A literal excerpt, not a generated claim or a new quantitative assertion.
    clause = re.split(r'[。；！？\n]', text, maxsplit=1)[0]
    if len(clause) <= 64:
        return clause
    # Prefer a complete clause before falling back to an explicitly bounded excerpt.
    for delimiter in ('，', '：', '、', ' '):
        first = clause.split(delimiter, 1)[0]
        if 0 < len(first) <= 64:
            return first
    return clause[:64]


def make_card(topic, record_id, title, aliases, details, steps, excerpt):
    return {
        'id': record_id, 'category': topic['title'], 'title': title,
        'question': f'{title}的政見提案內容是什麼？',
        'aliases': list(dict.fromkeys(a for a in aliases if len(a) > 2)),
        'summary': NOTICE + short_source(excerpt),
        'status': 'proposed',
        'sourceTitle': f'使用者提供政見提案｜{topic["title"]}',
        'sourceUrl': topic['sourceUrl'], 'sourceDate': None,
        # Import/check date only; not independent verification of the policy claims.
        'verifiedAt': IMPORT_DATE, 'details': details,
        'provenance': 'user-provided-archive', 'topicId': topic['id'],
        'mechanismSteps': steps,
    }


def knowledge_payload(root, topics):
    raw = (root / 'data' / 'knowledge.json').read_text(encoding='utf-8')
    decoder = json.JSONDecoder()
    cursor = raw.index('[') + 1
    for i in range(12):
        cursor += len(raw[cursor:]) - len(raw[cursor:].lstrip())
        original, cursor = decoder.raw_decode(raw, cursor)
        if not isinstance(original, dict) or original['id'].startswith('archive-'):
            raise ValueError('Expected the unchanged original 12 knowledge cards')
        if i < 11:
            cursor += len(raw[cursor:]) - len(raw[cursor:].lstrip())
            if raw[cursor] != ',':
                raise ValueError('Expected 12 original knowledge cards')
            cursor += 1
    prefix = raw[:cursor] + '\n'
    if hashlib.sha256(prefix.encode('utf-8')).hexdigest() != ORIGINAL_PREFIX_SHA256:
        raise ValueError('Original 12 knowledge card bytes changed; refusing to overwrite')
    cards = []
    for topic in topics:
        details = [NOTICE]
        for stage in topic['stages']:
            details.extend([stage['n'], stage['t'], stage['s'], stage['note'], *stage['chips']])
        details.append(topic['detailNote'])
        aliases = [topic['title'], *[p['title'] for p in topic['pads']],
                   *[chip for stage in topic['stages'] for chip in stage['chips']]]
        cards.append(make_card(topic, topic['recordIds'][0], topic['title'] + '｜政策總覽',
                               aliases, details,
                               [short_source(s['t']) for s in topic['stages'][:3]],
                               topic['stages'][0]['s']))
        for pad in topic['pads']:
            cards.append(make_card(topic, pad['recordId'], pad['title'],
                                   [pad['title'], topic['title']],
                                   [NOTICE, pad['description'], *pad['details'], topic['detailNote']],
                                   [short_source(pad['title']), short_source(pad['description']),
                                    short_source(pad['details'][0])], pad['description']))
    appended = json.dumps(cards, ensure_ascii=False, indent=2)[2:-2]
    return (raw[:cursor] + ',\n' + appended + '\n]\n').encode('utf-8')


def import_archive(zip_path, root):
    digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    if digest != SOURCE_SHA256:
        raise ValueError('Archive SHA256 does not match the supplied source')
    with zipfile.ZipFile(zip_path) as archive:
        names = archive.namelist()
        if len(names) != 16 or set(names) != set(SOURCE_FILES) | {'index.html'}:
            raise ValueError('Archive must contain exactly the 15 expected subpages and index.html')
        topics = [parse_topic(name, archive.read(name).decode('utf-8')) for name in SOURCE_FILES]
    catalog = {
        'version': 1,
        'source': {'kind': 'user-provided-archive', 'filename': 'taichung-machine-site.zip',
                   'sha256': digest, 'importedAt': IMPORT_DATE,
                   'verification': 'supplied-not-independently-verified'},
        'topics': topics,
    }
    payload = (json.dumps(catalog, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    knowledge = knowledge_payload(root, topics)
    for directory in ('data', 'public'):
        target = root / directory / 'policy-catalog.json'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        (root / directory / 'knowledge.json').write_bytes(knowledge)
    return catalog


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('zip_path', type=Path, help='Explicit path to the supplied ZIP')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent.parent,
                        help='Output repository root (default: script parent repository)')
    args = parser.parse_args()
    try:
        catalog = import_archive(args.zip_path, args.root)
    except (ValueError, OSError, zipfile.BadZipFile) as error:
        parser.exit(1, f'Import failed: {error}\n')
    topics = catalog['topics']
    pads = [pad for topic in topics for pad in topic['pads']]
    stages = [stage for topic in topics for stage in topic['stages']]
    added = sum(len(topic['recordIds']) for topic in topics)
    print(json.dumps({'topics': len(topics), 'stages': len(stages), 'pads': len(pads),
                      'bullets': sum(len(pad['details']) for pad in pads),
                      'chips': sum(len(stage['chips']) for stage in stages),
                      'addedRecords': added, 'totalRecords': 12 + added}, ensure_ascii=False))


if __name__ == '__main__':
    main()

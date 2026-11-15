import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rawkode_academy_mobile/thumbnail_cache.dart';

void main() {
  test('makes a complete 206 image cacheable', () async {
    final bytes = utf8.encode('complete');
    final service = ThumbnailFileService(client: MockClient((_) async => http.Response.bytes(bytes, 206,
      headers: {'content-range': 'bytes 0-7/8', 'content-type': 'image/webp'})));
    final result = await service.get('https://example.com/image.webp');
    expect(result.statusCode, 200);
    expect(await result.content.expand((chunk) => chunk).toList(), bytes);
  });

  test('rejects a partial or truncated image', () async {
    final partial = ThumbnailFileService(client: MockClient((_) async => http.Response.bytes([1, 2], 206,
      headers: {'content-range': 'bytes 0-1/4'})));
    await expectLater(partial.get('https://example.com/image.webp'), throwsFormatException);
    final truncated = ThumbnailFileService(client: MockClient((_) async => http.Response.bytes([1, 2], 206,
      headers: {'content-range': 'bytes 0-3/4'})));
    await expectLater(truncated.get('https://example.com/image.webp'), throwsFormatException);
  });
}

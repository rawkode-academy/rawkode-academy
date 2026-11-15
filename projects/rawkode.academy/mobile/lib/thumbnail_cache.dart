import 'dart:typed_data';

import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:http/http.dart' as http;

/// The CDN may return an entire image as 206; cache only complete ranges.
class ThumbnailFileService extends FileService {
  ThumbnailFileService({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;

  @override
  Future<FileServiceResponse> get(String url, {Map<String, String>? headers}) async {
    final uri = Uri.parse(url);
    final request = http.Request('GET', uri);
    if (headers != null) request.headers.addAll(headers);
    final response = await _client.send(request).timeout(const Duration(seconds: 20));
    if (response.statusCode != 206) return HttpGetResponse(response);

    final range = RegExp(r'^bytes 0-(\d+)/(\d+)$').firstMatch(response.headers['content-range'] ?? '');
    final end = range == null ? null : int.tryParse(range.group(1)!);
    final total = range == null ? null : int.tryParse(range.group(2)!);
    const maxImageBytes = 5 * 1024 * 1024;
    if (end == null || total == null || end + 1 != total || total > maxImageBytes) {
      throw const FormatException('Incomplete thumbnail');
    }
    final bytes = BytesBuilder(copy: false);
    await for (final chunk in response.stream.timeout(const Duration(seconds: 20))) {
      bytes.add(chunk);
      if (bytes.length > maxImageBytes || bytes.length > total) throw const FormatException('Invalid thumbnail size');
    }
    if (bytes.length != total) throw const FormatException('Incomplete thumbnail');
    final complete = bytes.takeBytes();
    return HttpGetResponse(http.StreamedResponse(Stream.value(complete), 200,
      contentLength: complete.length, headers: response.headers, request: request));
  }
}

final watchThumbnailCache = CacheManager(Config(
  'watchThumbnails',
  stalePeriod: const Duration(days: 30),
  maxNrOfCacheObjects: 400,
  fileService: ThumbnailFileService(),
));

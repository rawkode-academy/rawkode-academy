import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class AcademyAccount extends ChangeNotifier {
  AcademyAccount({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;
  final _auth = const FlutterAppAuth();
  final _storage = const FlutterSecureStorage();
  String? _token;
  Map<String, dynamic>? user;
  static const _origin = 'https://rawkode.academy';
  static const _redirect = 'academy.rawkode.app:/oauth2redirect';
  static const _clientId = 'rawkode-academy-mobile';
  static final _config = AuthorizationServiceConfiguration(
    authorizationEndpoint: 'https://id.rawkode.academy/auth/oauth2/authorize',
    tokenEndpoint: 'https://id.rawkode.academy/auth/oauth2/token',
  );

  Future<bool> restore() async {
    _token = await _storage.read(key: 'access_token');
    if (_token == null) return false;
    return _loadUser();
  }

  Future<bool> signIn() async {
    final result = await _auth.authorizeAndExchangeCode(
      AuthorizationTokenRequest(_clientId, _redirect,
        serviceConfiguration: _config, scopes: ['openid', 'profile', 'email']),
    );
    final token = result.accessToken;
    if (token == null || token.isEmpty) return false;
    _token = token;
    if (!await _loadUser()) {
      _token = null;
      return false;
    }
    await _storage.write(key: 'access_token', value: token);
    return true;
  }

  Future<bool> _loadUser() async {
    final response = await _client.get(Uri.https('id.rawkode.academy', '/api/mobile/session'), headers: _headers).timeout(const Duration(seconds: 15));
    if (response.statusCode == 401) {
      await signOut();
      return false;
    }
    if (response.statusCode != 200) throw StateError('Account service is unavailable');
    user = (jsonDecode(response.body) as Map<String, dynamic>)['user'] as Map<String, dynamic>;
    return true;
  }

  Map<String, String> get _headers => {'Authorization': 'Bearer $_token', 'Accept': 'application/json'};

  Future<dynamic> get(String path) async {
    final response = await _client.get(Uri.parse('$_origin$path'), headers: _headers).timeout(const Duration(seconds: 15));
    if (response.statusCode == 401) await signOut();
    return _decode(response);
  }

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final response = await _client.post(Uri.parse('$_origin$path'), headers: {..._headers, 'Content-Type': 'application/json'}, body: jsonEncode(body)).timeout(const Duration(seconds: 15));
    if (response.statusCode == 401) await signOut();
    return _decode(response);
  }

  dynamic _decode(http.Response response) {
    if (response.statusCode == 401) throw StateError('Your session has expired. Please sign in again.');
    if (response.statusCode < 200 || response.statusCode >= 300) throw StateError('The Academy service is unavailable. Please try again.');
    return jsonDecode(response.body);
  }

  Future<void> signOut() async {
    if (_token != null) {
      try {
        await _client.delete(Uri.https('id.rawkode.academy', '/api/mobile/session'), headers: _headers).timeout(const Duration(seconds: 10));
      } catch (_) {
        // Local credentials must still be removed when offline.
      }
    }
    _token = null;
    user = null;
    await _storage.delete(key: 'access_token');
    notifyListeners();
  }
}

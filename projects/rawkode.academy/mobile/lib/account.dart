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
  String? _refreshToken;
  Future<bool>? _refreshing;
  bool _signingOut = false;
  int _generation = 0;
  bool credentialCleanupRequired = false;
  Map<String, dynamic>? user;
  static const _origin = 'https://rawkode.academy';
  static const _redirect = 'academy.rawkode.app:/oauth2redirect';
  static const _clientId = 'rawkode-academy-mobile';
  static const _scopes = ['openid', 'profile', 'email', 'offline_access'];
  static final _config = AuthorizationServiceConfiguration(
    authorizationEndpoint: 'https://id.rawkode.academy/auth/oauth2/authorize',
    tokenEndpoint: 'https://id.rawkode.academy/auth/oauth2/token',
  );

  Future<bool> restore() async {
    _token = await _storage.read(key: 'access_token');
    _refreshToken = await _storage.read(key: 'refresh_token');
    if (_token == null) return false;
    return _loadUser();
  }

  Future<bool> signIn() async {
    if (_signingOut) throw StateError('Sign out is in progress');
    final generation = _generation;
    final result = await _auth.authorizeAndExchangeCode(
      AuthorizationTokenRequest(_clientId, _redirect, serviceConfiguration: _config, scopes: _scopes),
    );
    if (_signingOut || generation != _generation) return false;
    if (result.accessToken == null || result.accessToken!.isEmpty) return false;
    _token = result.accessToken;
    _refreshToken = result.refreshToken;
    if (!await _loadUser()) return false;
    await _saveTokens();
    return true;
  }

  Future<void> _saveTokens() async {
    await _storage.write(key: 'access_token', value: _token);
    if (_refreshToken == null) {
      await _storage.delete(key: 'refresh_token');
    } else {
      await _storage.write(key: 'refresh_token', value: _refreshToken);
    }
  }

  Future<bool> _refresh() async {
    if (_signingOut) return false;
    if (_refreshing != null) return _refreshing!;
    final pending = _performRefresh();
    _refreshing = pending;
    try { return await pending; } finally { _refreshing = null; }
  }

  Future<bool> _performRefresh() async {
    if (_refreshToken == null) return false;
    try {
      final result = await _auth.token(TokenRequest(_clientId, _redirect,
        refreshToken: _refreshToken, serviceConfiguration: _config, scopes: _scopes)).timeout(const Duration(seconds: 20));
      if (result.accessToken == null || result.accessToken!.isEmpty) return false;
      _token = result.accessToken;
      _refreshToken = result.refreshToken ?? _refreshToken;
      await _saveTokens();
      return true;
    } on FlutterAppAuthPlatformException catch (error) {
      final details = error.details;
      if (details is FlutterAppAuthPlatformErrorDetails && details.error == 'invalid_grant') return false;
      throw StateError('Could not refresh your session. Please retry.');
    } catch (_) {
      throw StateError('Could not refresh your session. Please retry.');
    }
  }

  Future<http.Response> _send(Future<http.Response> Function() request) async {
    if (_signingOut) throw StateError('Sign out is in progress');
    final generation = _generation;
    final usedToken = _token;
    var response = await request().timeout(const Duration(seconds: 15));
    if (_signingOut || generation != _generation) throw StateError('Session changed');
    if (response.statusCode == 401) {
      if ((_token != usedToken && _token != null) || await _refresh()) {
        response = await request().timeout(const Duration(seconds: 15));
      }
      if (_signingOut || generation != _generation) throw StateError('Session changed');
      if (response.statusCode == 401) await signOut();
    }
    return response;
  }

  Future<bool> _loadUser() async {
    final generation = _generation;
    final response = await _send(() => _client.get(Uri.https('id.rawkode.academy', '/api/mobile/session'), headers: _headers));
    if (_signingOut || generation != _generation) return false;
    if (response.statusCode == 401) return false;
    if (response.statusCode != 200) throw StateError('Account service is unavailable');
    user = (jsonDecode(response.body) as Map<String, dynamic>)['user'] as Map<String, dynamic>;
    return true;
  }

  Map<String, String> get _headers => {'Authorization': 'Bearer $_token', 'Accept': 'application/json'};

  Future<dynamic> get(String path) async {
    final response = await _send(() => _client.get(Uri.parse('$_origin$path'), headers: _headers));
    return _decode(response);
  }

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final response = await _send(() => _client.post(Uri.parse('$_origin$path'), headers: {..._headers, 'Content-Type': 'application/json'}, body: jsonEncode(body)));
    return _decode(response);
  }

  dynamic _decode(http.Response response) {
    if (response.statusCode == 401) throw StateError('Your session has expired. Please sign in again.');
    if (response.statusCode < 200 || response.statusCode >= 300) throw StateError('The Academy service is unavailable. Please try again.');
    return jsonDecode(response.body);
  }

  Future<void> signOut() async {
    if (_signingOut) return;
    _signingOut = true;
    _generation++;
    try {
      if (_refreshing != null) await _refreshing;
    } catch (_) {
      // Continue clearing local credentials if refresh failed.
    }
    if (_token != null) {
      try {
        await _client.delete(Uri.https('id.rawkode.academy', '/api/mobile/session'), headers: _headers).timeout(const Duration(seconds: 10));
      } catch (_) {
        // Remove local credentials even if revocation cannot be reached.
      }
    }
    _token = null;
    _refreshToken = null;
    user = null;
    Object? deletionError;
    try {
      try { await _storage.delete(key: 'access_token'); } catch (error) { deletionError = error; }
      try { await _storage.delete(key: 'refresh_token'); } catch (error) { deletionError ??= error; }
    } finally {
      credentialCleanupRequired = deletionError != null;
      _signingOut = false;
      notifyListeners();
    }
    if (deletionError != null) throw StateError('Could not remove saved credentials. Please try signing out again.');
  }
}

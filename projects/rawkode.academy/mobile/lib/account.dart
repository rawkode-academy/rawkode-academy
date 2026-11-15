import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

/// Show a safe diagnostic code without exposing URLs, tokens, or server text.
String signInErrorMessage(Object error) {
  if (error is FlutterAppAuthUserCancelledException) {
    return 'Sign-in was cancelled.';
  }
  if (error is FlutterAppAuthPlatformException) {
    final details = error.platformErrorDetails;
    const oauthErrors = {
      'invalid_request', 'invalid_client', 'invalid_grant', 'unauthorized_client',
      'unsupported_grant_type', 'invalid_scope', 'access_denied', 'server_error',
      'temporarily_unavailable',
    };
    final numeric = RegExp(r'^\d{1,6}$');
    final codes = [
      if (details.type != null && numeric.hasMatch(details.type!)) details.type!,
      if (details.code != null && numeric.hasMatch(details.code!)) details.code!,
      if (oauthErrors.contains(details.error)) details.error!,
    ].join('/');
    return codes.isEmpty
        ? 'Sign-in failed in the browser or account service. Please try again.'
        : 'Sign-in failed (authentication error $codes). Please try again.';
  }
  if (error is AccountLookupException) {
    return 'Sign-in succeeded, but your account could not be loaded (HTTP ${error.statusCode}).';
  }
  return 'Could not sign in. Please check your connection and try again.';
}

class AccountLookupException implements Exception {
  const AccountLookupException(this.statusCode);
  final int statusCode;
}

abstract class CredentialStorage {
  Future<String?> read({required String key});
  Future<void> write({required String key, required String? value});
  Future<void> delete({required String key});
}

class SecureCredentialStorage implements CredentialStorage {
  const SecureCredentialStorage();
  static const _storage = FlutterSecureStorage();
  @override
  Future<String?> read({required String key}) => _storage.read(key: key);
  @override
  Future<void> write({required String key, required String? value}) => _storage.write(key: key, value: value);
  @override
  Future<void> delete({required String key}) => _storage.delete(key: key);
}

class AcademyAccount extends ChangeNotifier {
  AcademyAccount({http.Client? client, FlutterAppAuth? auth, CredentialStorage? storage})
      : _client = client ?? http.Client(), _auth = auth ?? const FlutterAppAuth(), _storage = storage ?? const SecureCredentialStorage();
  final http.Client _client;
  final FlutterAppAuth _auth;
  final CredentialStorage _storage;
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
    final stored = await _storage.read(key: 'token_pair');
    if (stored != null) {
      final pair = jsonDecode(stored) as Map<String, dynamic>;
      _token = pair['access'] as String?;
      _refreshToken = pair['refresh'] as String?;
    } else {
      _token = await _storage.read(key: 'access_token');
      _refreshToken = await _storage.read(key: 'refresh_token');
    }
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
    await _storage.write(key: 'token_pair', value: jsonEncode({'access': _token, 'refresh': _refreshToken}));
    // Remove keys from earlier preview builds after the pair is safely stored.
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
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
      if (error.platformErrorDetails.error == FlutterAppAuthOAuthError.invalidGrant) return false;
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
        if (_signingOut || generation != _generation) throw StateError('Session changed');
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
    if (response.statusCode == 401) throw const AccountLookupException(401);
    if (_signingOut || generation != _generation) return false;
    if (response.statusCode != 200) throw AccountLookupException(response.statusCode);
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

  Future<bool> signOut() async {
    if (_signingOut) return false;
    _signingOut = true;
    _generation++;
    try {
      if (_refreshing != null) await _refreshing;
    } catch (_) {
      // Continue clearing local credentials if refresh failed.
    }
    var revoked = true;
    if (_token != null) {
      try {
        final response = await _client.delete(Uri.https('id.rawkode.academy', '/api/mobile/session'), headers: _headers).timeout(const Duration(seconds: 10));
        revoked = response.statusCode >= 200 && response.statusCode < 300;
      } catch (_) {
        revoked = false;
      }
    }
    _token = null;
    _refreshToken = null;
    user = null;
    Object? deletionError;
    try {
      try { await _storage.delete(key: 'token_pair'); } catch (error) { deletionError = error; }
      try { await _storage.delete(key: 'access_token'); } catch (error) { deletionError ??= error; }
      try { await _storage.delete(key: 'refresh_token'); } catch (error) { deletionError ??= error; }
    } finally {
      credentialCleanupRequired = deletionError != null;
      _signingOut = false;
      notifyListeners();
    }
    if (deletionError != null) throw StateError('Could not remove saved credentials. Please try signing out again.');
    return revoked;
  }
}

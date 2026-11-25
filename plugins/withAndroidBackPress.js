const { withMainActivity } = require('expo/config-plugins');

function ensureOnNewIntentForwarding(contents) {
  if (contents.includes('override fun onNewIntent(')) {
    return contents;
  }

  if (!contents.includes('import android.content.Intent')) {
    contents = contents.replace(
      'import android.os.Bundle',
      'import android.content.Intent\nimport android.os.Bundle'
    );
  }

  const onNewIntentCode = `
  override fun onNewIntent(intent: Intent) {
    // Keep activity.intent up-to-date so Linking.getInitialURL() sees deep-link intents
    // even if received before React finishes mounting on singleTask launchMode.
    setIntent(intent)
    super.onNewIntent(intent)
  }`;

  const lastBraceIndex = contents.lastIndexOf('}');
  if (lastBraceIndex !== -1) {
    contents = contents.slice(0, lastBraceIndex) + onNewIntentCode + '\n}\n';
  }

  return contents;
}

function modifyMainActivity(contents) {
  if (contents.includes('OnBackPressedCallback')) {
    return ensureOnNewIntentForwarding(contents);
  }

  // 1. Add imports
  if (!contents.includes('import android.content.Intent')) {
    contents = contents.replace(
      'import android.os.Bundle',
      'import android.content.Intent\nimport android.os.Bundle'
    );
  }
  if (!contents.includes('import android.os.Build')) {
    contents = contents.replace(
      'import android.os.Bundle',
      'import android.os.Build\nimport android.os.Bundle'
    );
  }
  if (!contents.includes('androidx.activity.OnBackPressedCallback')) {
    contents = contents.replace(
      'import android.os.Bundle',
      'import android.os.Bundle\nimport androidx.activity.OnBackPressedCallback'
    );
  }

  // 2. Add backCallback property and bridge in onCreate
  const classDeclaration = 'class MainActivity : ReactActivity() {';
  const callbackCode = `class MainActivity : ReactActivity() {
  private var lastBackPressTime: Long = 0L

  private val backCallback = object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
      val now = System.currentTimeMillis()
      if (now - lastBackPressTime < 300L) {
        return
      }
      lastBackPressTime = now
      isEnabled = false
      onBackPressed()
      isEnabled = true
    }
  }`;

  contents = contents.replace(classDeclaration, callbackCode);

  const onCreateSuper = 'super.onCreate(null)';
  const onCreateBridge = `super.onCreate(null)

    // Bridge AndroidX OnBackPressedDispatcher to React Native's onBackPressed handler
    onBackPressedDispatcher.addCallback(this, backCallback)`;

  contents = contents.replace(onCreateSuper, onCreateBridge);

  // 3. Add or replace invokeDefaultOnBackPressed override cleanly
  const invokeDefaultCode = `  override fun invokeDefaultOnBackPressed() {
    backCallback.isEnabled = false
    try {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
        if (!moveTaskToBack(false)) {
          super.invokeDefaultOnBackPressed()
        }
        return
      }
      if (isTaskRoot && moveTaskToBack(false)) {
        return
      }
      super.invokeDefaultOnBackPressed()
    } finally {
      backCallback.isEnabled = true
    }
  }`;

  const fnIdx = contents.indexOf('override fun invokeDefaultOnBackPressed()');
  if (fnIdx !== -1) {
    const openBrace = contents.indexOf('{', fnIdx);
    if (openBrace !== -1) {
      let depth = 1;
      let closeBrace = -1;
      for (let i = openBrace + 1; i < contents.length; i++) {
        if (contents[i] === '{') depth++;
        else if (contents[i] === '}') {
          depth--;
          if (depth === 0) {
            closeBrace = i;
            break;
          }
        }
      }
      if (closeBrace !== -1) {
        contents = contents.slice(0, fnIdx) + invokeDefaultCode + contents.slice(closeBrace + 1);
      }
    }
  } else {
    const lastBraceIndex = contents.lastIndexOf('}');
    if (lastBraceIndex !== -1) {
      contents = contents.slice(0, lastBraceIndex) + '\n' + invokeDefaultCode + '\n}\n';
    }
  }

  return ensureOnNewIntentForwarding(contents);
}

module.exports = function withAndroidBackPress(config) {
  return withMainActivity(config, (config) => {
    config.modResults.contents = modifyMainActivity(config.modResults.contents);
    return config;
  });
};
module.exports.modifyMainActivity = modifyMainActivity;


function show(platform, device, osVersion) {
    const classes = document.body.classList;
    classes.add(platform, device);

    // iOS 18 moved app settings under Settings > Apps; macOS 13 renamed
    // Safari Preferences to Settings.
    if (platform === 'ios' && osVersion < 18) {
        classes.add('ios-17');
    }
    if (platform === 'mac' && osVersion < 13) {
        classes.add('mac-12');
    }
}

function showState(enabled) {
    document.body.classList.add(enabled ? 'state-on' : 'state-off');
}

document.querySelector('button.open-settings').addEventListener('click', () => {
    webkit.messageHandlers.controller.postMessage('open-settings');
});

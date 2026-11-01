import XCTest

// Performs UI commands for the screenshot script, which serves them from the
// Mac over HTTP: GET /next long-polls for a command, POST /done reports it.
// The steps live in the script; this only knows how to touch the screen.
final class Driver: XCTestCase {
  func testRun() throws {
    guard let base = ProcessInfo.processInfo.environment["DRIVER_URL"].flatMap(URL.init(string:)) else {
      throw XCTSkip("DRIVER_URL is not set")
    }
    while true {
      let command = try request(base.appendingPathComponent("next"))
      let id = command["id"] as? Int ?? 0
      if command["action"] as? String == "quit" {
        _ = try? request(base.appendingPathComponent("done"), body: ["id": id])
        return
      }
      var reply: [String: Any] = ["id": id]
      do {
        reply["result"] = try perform(command)
      } catch {
        reply["error"] = "\(error)"
      }
      _ = try request(base.appendingPathComponent("done"), body: reply)
    }
  }

  private func perform(_ c: [String: Any]) throws -> Any {
    switch c["action"] as? String {
    case "activate":
      app(c).activate()
      return true
    case "tree":
      return app(c).debugDescription
    case "exists":
      return query(c).waitForExistence(timeout: c["timeout"] as? Double ?? 0)
    case "tap":
      try find(c).tap()
      return true
    case "tapPoint":
      // Normalised to the app's frame, for things with no accessible element.
      app(c).coordinate(withNormalizedOffset: CGVector(dx: c["x"] as! Double, dy: c["y"] as! Double)).tap()
      return true
    case "value":
      return try find(c).value.map { "\($0)" } ?? ""
    case "frame":
      let f = try find(c).frame
      return [f.minX, f.minY, f.width, f.height]
    case "home":
      XCUIDevice.shared.press(.home)
      return true
    case "orientation":
      XCUIDevice.shared.orientation = try orientation(c["value"] as? String)
      return true
    default:
      throw DriverError("unknown action \(c["action"] ?? "nil")")
    }
  }

  private func app(_ c: [String: Any]) -> XCUIApplication {
    XCUIApplication(bundleIdentifier: c["bundle"] as? String ?? "com.apple.mobilesafari")
  }

  // Matches on element type plus a label and/or identifier, exactly or by
  // case-insensitive substring.
  private func query(_ c: [String: Any]) -> XCUIElement {
    let type = Self.types[c["type"] as? String ?? "any"] ?? .any
    var parts: [NSPredicate] = []
    let op = c["contains"] as? Bool == true ? "CONTAINS[c]" : "=="
    if let label = c["label"] as? String {
      parts.append(NSPredicate(format: "label \(op) %@", label))
    }
    if let identifier = c["identifier"] as? String {
      parts.append(NSPredicate(format: "identifier \(op) %@", identifier))
    }
    let matches = app(c).descendants(matching: type).matching(NSCompoundPredicate(andPredicateWithSubpredicates: parts))
    return matches.element(boundBy: c["index"] as? Int ?? 0)
  }

  private func find(_ c: [String: Any]) throws -> XCUIElement {
    let element = query(c)
    let deadline = Date().addingTimeInterval(c["timeout"] as? Double ?? 10)
    guard c["scroll"] as? Bool == true else {
      guard element.waitForExistence(timeout: deadline.timeIntervalSinceNow) else {
        throw DriverError("no element matching \(c)")
      }
      return element
    }
    // Lists only build the rows on screen, so scroll until it appears, once
    // the list has rows at all (a fresh Settings fills its lists late).
    var swipes = 0
    while !(element.exists && element.isHittable) {
      guard Date() < deadline else { throw DriverError("no element matching \(c)") }
      if swipes < 12 && app(c).cells.count > 0 {
        app(c).swipeUp(velocity: .slow)
        swipes += 1
      } else {
        Thread.sleep(forTimeInterval: 0.5)
      }
    }
    return element
  }

  private func orientation(_ name: String?) throws -> UIDeviceOrientation {
    switch name {
    case "portrait": return .portrait
    case "landscapeLeft": return .landscapeLeft
    case "landscapeRight": return .landscapeRight
    default: throw DriverError("unknown orientation \(name ?? "nil")")
    }
  }

  private static let types: [String: XCUIElement.ElementType] = [
    "any": .any, "button": .button, "cell": .cell, "link": .link, "other": .other,
    "staticText": .staticText, "switch": .switch, "textField": .textField, "webView": .webView,
  ]

  private func request(_ url: URL, body: [String: Any]? = nil) throws -> [String: Any] {
    var req = URLRequest(url: url, timeoutInterval: 900)
    if let body {
      req.httpMethod = "POST"
      req.httpBody = try JSONSerialization.data(withJSONObject: body)
    }
    let done = DispatchSemaphore(value: 0)
    var result: Result<Data, Error> = .failure(DriverError("no response"))
    URLSession.shared.dataTask(with: req) { data, _, error in
      result = error.map { .failure($0) } ?? .success(data ?? Data())
      done.signal()
    }.resume()
    done.wait()
    let data = try result.get()
    return data.isEmpty ? [:] : try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
  }
}

struct DriverError: Error, CustomStringConvertible {
  let description: String
  init(_ description: String) { self.description = description }
}

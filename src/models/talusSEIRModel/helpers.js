// https://www.reddit.com/r/javascript/comments/7o3mjp/9_different_explicit_numerical_integrators/
// Some explicit integrators in Butcher's tableau form. (first zero row skipped)
export const integrationMethods = {
    Euler: [[1]],
    Midpoint: [[.5, .5], [0, 1]],
    Heun: [[1, 1], [.5, .5]],
    Ralston: [[2 / 3, 2 / 3], [.25, .75]],
    K3: [[.5, .5], [1, -1, 2], [1 / 6, 2 / 3, 1 / 6]],
    SSP33: [[1, 1], [.5, .25, .25], [1 / 6, 1 / 6, 2 / 3]],
    SSP43: [[.5, .5], [1, .5, .5], [.5, 1 / 6, 1 / 6, 1 / 6], [1 / 6, 1 / 6, 1 / 6, 1 / 2]],
    RK4: [[.5, .5], [.5, 0, .5], [1, 0, 0, 1], [1 / 6, 1 / 3, 1 / 3, 1 / 6]],
    RK38: [[1 / 3, 1 / 3], [2 / 3, -1 / 3, 1], [1, 1, -1, 1], [1 / 8, 3 / 8, 3 / 8, 1 / 8]]
};

export const integrate = (m, f, y, t, h) => {
    for (var k = [], ki = 0; ki < m.length; ki++) {
        var _y = y.slice(), dt = ki ? ((m[ki - 1][0]) * h) : 0;
        for (var l = 0; l < _y.length; l++) for (var j = 1; j <= ki; j++) _y[l] = _y[l] + h * (m[ki - 1][j]) * (k[ki - 1][l]);
        k[ki] = f(t + dt, _y, dt);
    }
    for (var r = y.slice(), l = 0; l < _y.length; l++) for (var j = 0; j < k.length; j++) r[l] = r[l] + h * (k[j][l]) * (m[ki - 1][j]);
    return r;
}

export const sum = arr => arr.reduce((acc, cur) => acc + cur, 0)

export const dotProduct = (vector1, vector2) => {
    let result = 0;
    for (let i = 0; i < 3; i++) {
        result += vector1[i] * vector2[i];
    }
    return result;
}

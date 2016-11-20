import { expect, use as chaiUse } from "chai";
import chaiAsPromised = require("chai-as-promised");
import * as td from "testdouble";
import { CallDataTwiml } from "twilio";
import "../../../lib/twilioAugments";
import * as sut from "../../../lib/util/routeCreationHelpers";
import * as State from "../../../lib/state";
import * as states from "../../fixtures/states";

chaiUse(chaiAsPromised);

describe("route creation utilities", () => {
  describe("resolveBranches", () => {
    const thrower = () => { throw new Error("unexpected.") };
    type SutReturn = Promise<State.RenderableState>;

    describe("handling renderable input states", () => {
      it("should return a promise for the input state", () => {
        const results: any[] = states.renderableStates.map(state =>
          [state, sut.resolveBranches(state, <CallDataTwiml>{})]
        );

        const assertions = results.map(([state, resultPromise]) => {
          return (<SutReturn>resultPromise).then((resolvedState) => {
            expect(state).to.equal(resolvedState);
          });
        });

        return Promise.all(assertions);
      });
    });

    describe("handling branching, non-renderable states", () => {
      let g: any, h: any, i: any;

      beforeEach(function() {
        g = td.object(<State.NormalState>{
          name: "g",
          processTransitionUri: "/whatevs",
          twimlFor: () => "",
          transitionOut: (input) => Promise.resolve(this)
        });

        h = td.object(<State.BranchingState>{
          name: "h",
          transitionOut: (input) => Promise.resolve(this)
        });

        i = td.object(<State.BranchingState>{
          name: "i",
          transitionOut: (input) => Promise.resolve(this),
        });

        td.when(i.transitionOut(td.matchers.anything()))
          .thenResolve(h);

        td.when(h.transitionOut(td.matchers.anything()))
          .thenResolve(g);
      });

      it("should pass any input data to the first non-renderable state, but not subsequent ones", () => {
        return sut.resolveBranches(i, <CallDataTwiml>{}).then(state => {
          td.verify(i.transitionOut({}));
          td.verify(h.transitionOut(undefined));
        });
      });

      it("should not call transition out on the renderable state, once found", () => {
        return sut.resolveBranches(i, <CallDataTwiml>{}).then(state => {
          td.verify(g.transitionOut(), {times: 0, ignoreExtraArgs: true});
        });
      });
    });
  });

  describe("urlFor", () => {
    const urlForBound = sut.urlFor("ftp", "localhost", "/static", (it) => it + '?v=1');
    const urlForBoundMountless = sut.urlFor("ftp", "localhost", "", (it) => it + '?v=1');

    it("should reject an attempt to fingerprint a uri with a query parameter", () => {
      expect(() => {
        urlForBound('/static/test', {query: {a: 'b'}, absolute: false, fingerprint: true})
      }).to.throw();
      expect(() => {
        urlForBound('/static/test', {query: {a: 'b'}, absolute: true, fingerprint: true})
      }).to.throw();
    });

    it("should default fingerprint setting to !query", () => {
      expect(urlForBound('/static/test', {}).includes('v=1')).to.be.true;
      expect(urlForBound('/static/test', {query: {a: 'b'}}).includes('v=1')).to.be.false;
    });

    it("should default absolute to false", () => {
      expect(urlForBound('/static/test', {}).startsWith('/static/test')).to.be.true;
      expect(urlForBound('/static/test', {query: {a: 'b'}}).startsWith('/static/test')).to.be.true;
      expect(urlForBound('/static/test', {fingerprint: true}).startsWith('/static/test')).to.be.true;
    });

    it("should handle all the valid permutations of the options", () => {
      // Query can be true (in which case fingerprint must be falsey), with absolute as true or false.
      expect(urlForBound('/static/test', {query: {a: 'b'}, absolute: true})).to.equal('ftp://localhost/static/test?a=b');
      expect(urlForBound('/static/test', {query: {a: 'b'}, absolute: false})).to.equal('/static/test?a=b');

      // Or query can be falsey, with fingerprint true, with absolute true or false.
      expect(urlForBound('/static/test', { absolute: true })).to.equal('ftp://localhost/static/test?v=1');
      expect(urlForBound('/static/test', { absolute: false })).to.equal('/static/test?v=1');

      // Or both query and fingerprint can be falsey, with absolute true or false.
      expect(urlForBound('/static/test', {query: undefined, fingerprint: false, absolute: true})).to.equal('ftp://localhost/static/test');
      expect(urlForBound('/static/test', {query: undefined, fingerprint: false, absolute: false})).to.equal('/static/test');

      // All of the above combinations can happen without a mount path too.
      expect(urlForBoundMountless('/test', {query: {a: 'b'}, absolute: true})).to.equal('ftp://localhost/test?a=b');
      expect(urlForBoundMountless('/test', {query: {a: 'b'}, absolute: false})).to.equal('/test?a=b');

      expect(urlForBoundMountless('/test', { absolute: true })).to.equal('ftp://localhost/test?v=1');
      expect(urlForBoundMountless('/test', { absolute: false })).to.equal('/test?v=1');

      expect(urlForBoundMountless('/test', {query: undefined, fingerprint: false, absolute: true})).to.equal('ftp://localhost/test');
      expect(urlForBoundMountless('/test', {query: undefined, fingerprint: false, absolute: false})).to.equal('/test');
    });
  })
});

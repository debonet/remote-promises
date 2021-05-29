const RemotePromises = require( "../src/remote-promises.js" );

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
test( "test a forward remote promise", async () => {

	const fp = () => new Promise(( fOk ) => {
		return setTimeout(() => fOk( "success" ), 100 )
	});
	
	const rps = RemotePromises.serve( fp, 3000 );

	const fpNew = RemotePromises.client( "ws://localhost:3000" );

	expect( await fpNew()).toBe( "success" );

	rps.close();
	fpNew.close();
	
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
test( "test a forward remote promise error", async () => {

	const fp = () => new Promise(( fOk, fErr ) => {
		return setTimeout(() => fErr( "error" ), 100 )
	});
	
	const rps = RemotePromises.serve( fp, 3000 );

	const fpNew = RemotePromises.client( "ws://localhost:3000" );

	try{
		await fpNew();
	}
	catch( err ){
		expect( err ).toBe( "error" );
	}

	rps.close();
	fpNew.close();
	
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
test( "test a forward remote constant-promise", async () => {

	const fp = () => "success";
	
	const rps = RemotePromises.serve( fp, 3000 );

	const fpNew = RemotePromises.client( "ws://localhost:3000" );

	expect( await fpNew()).toBe( "success" );

	rps.close();
	fpNew.close();
	
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
test( "test a flipped remote promise", async () => {

	const fp = () => new Promise(( fOk ) => {
		return setTimeout(() => {
			fOk( "success" );
		}, 100 );
	});
	
	const fpNew = RemotePromises.marshal( 3000 );

	const rps = RemotePromises.provide( fp, "ws://localhost:3000" );

	expect( await fpNew()).toBe( "success" );

	rps.close();
	fpNew.close();
});



// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
test( "test a flipped remote promise error", async () => {

	const fp = () => new Promise(( fOk, fErr ) => {
		return setTimeout(() => {
			fErr( "error" );
		}, 100 );
	});
	
	const fpNew = RemotePromises.marshal( 3000 );

	const rps = RemotePromises.provide( fp, "ws://localhost:3000" );

	try{
		await fpNew();
	}
	catch( err ){
		expect( err ).toBe( "error" );
	}

	rps.close();
	fpNew.close();
});


// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
test( "test a flipped remote promise with multiple handlers", async () => {

	const fp = ( n ) => new Promise(( fOk ) => {
		return setTimeout(() => {
			fOk( "success " + n );
		}, 1000 );
	});
	
	const fpNew = RemotePromises.marshal( 3000 );

	const rps1 = RemotePromises.provide(() => fp( 1 ), "ws://localhost:3000" );
	const rps2 = RemotePromises.provide(() => fp( 2 ), "ws://localhost:3000" );

	setTimeout( async () => {
		const vs = await Promise.all([
			fpNew(), fpNew(), fpNew(),
			fpNew(), fpNew(), fpNew(),
		])
		expect( vs ).toStrictEqual([
			'success 2', 'success 1', 'success 2',
			'success 1', 'success 2', 'success 1'
		]);
		const rps3 = RemotePromises.provide(() => fp( 3 ), "ws://localhost:3000" );

		setTimeout( async () => {

			const vs = await Promise.all([
				fpNew(), 	fpNew(), 	fpNew(), 	fpNew(), 	fpNew(), 	fpNew(), ])

			expect( vs ).toStrictEqual([
				'success 3', 	'success 2', 	'success 1',
				'success 3', 	'success 2', 	'success 1'
			]);

			rps1.close();
			rps2.close();
			rps3.close();
			fpNew.close();
		}, 100 );
	}, 100 );

	fpNew.close();
	rps1.close();
	rps2.close();
	
});










// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
function delay( dtm ){
	return new Promise(( fOk ) => setTimeout( fOk, dtm ));
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
test( "test a forward disconnection", async () => {

	const fp = ( x ) => new Promise(( fOk ) => {
		return setTimeout(() => fOk( "success " + x ), 100 )
	});
	
	const rps1 = RemotePromises.serve(() => fp( 1 ), 3000 );
	const fpNew = RemotePromises.client( "ws://localhost:3000", {
		reconnectionDelay: 100,
		reconnectionDelayMax : 100,
	});

	expect( await fpNew()).toBe( "success 1" );

	let b = false;
	
	fpNew().then(( x ) => {
		b = true;
		expect( x ).toBe( "success 2" );
	});
	
	rps1.close();

	await delay( 100 );
	
	expect( b ).toBe( false );

	const rps2 = RemotePromises.serve(() => fp( 2 ), 3000 );

	await delay( 300 );

	expect( b ).toBe( true );

	
	rps2.close();
	fpNew.close();
	
});




// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
test( "test a flipped disconnection", async () => {

	const fp = ( x ) => new Promise(( fOk ) => {
		return setTimeout(() => fOk( "success " + x ), 100 )
	});
	
	const rps1 = RemotePromises.provide(() => fp( 1 ), "ws://localhost:3000" );
	const fpNew = RemotePromises.marshal( 3000 );

	expect( await fpNew()).toBe( "success 1" );

	let b = false;
	
	fpNew().then(( x ) => {
		b = true;
		expect( x ).toBe( "success 2" );
	});
	
	rps1.close();

	await delay( 100 );
	
	expect( b ).toBe( false );

	const rps2 = RemotePromises.provide(() => fp( 2 ), "ws://localhost:3000" );

	await delay( 1000 );

	expect( b ).toBe( true );

	
	rps2.close();
	fpNew.close();
	
	
});

/**/

